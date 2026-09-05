# Deep Dive: Storing All Files as JSON in the Database

## TL;DR

The system **already does most of what you're describing** — it extracts every uploaded file into structured JSON (`fields`, `pages`, `rawText`) and stores that in PostgreSQL via the `DocumentExtraction` model. The only thing it does NOT do is store the **raw binary file content** inside the database. Whether to do that is a tradeoff worth examining.

---

## What the Current Architecture Already Does

After a file is uploaded to Backblaze B2, `triggerExtraction` fires the `ExtractionPipeline` (`backend/src/modules/documentExtraction/extractionPipeline.ts:59`):

1. **Fetch from storage** — downloads the file from S3 into a Buffer (`fetchAndParse`, line 175).
2. **Parse** — the `ParserRegistry` routes by content type to format-specific parsers:
   | Format | Parser | Key file |
   |---|---|---|
   | PDF | `PDFParser` (pdf-parse + tesseract OCR) | `parsers/pdfParser.ts` |
   | Images (PNG/JPG/WEBP) | `ImageParser` (tesseract OCR) | `parsers/imageParser.ts` |
   | DOC/DOCX | `DocxParser` (mammoth) | `parsers/officeParser.ts` |
   | XLS/XLSX | `XlsxParser` (xlsx lib) | `parsers/officeParser.ts` |
   | CSV | text | included in office parser path |
3. **Classify** — matches filename + text keywords against `DocumentType` patterns (`classifier.ts`).
4. **Extract fields** — runs both regex extractors (`ExtractorRegistry`) and an LLM extractor, then merges by confidence (`mergeLlmAndRegex`, line 249).
5. **Persist as JSON** — writes three columns to `DocumentExtraction`:
   - `documentType` — e.g. `PAN_CARD`, `BANK_STATEMENT`
   - `rawText` — full extracted text (capped at 200K chars)
   - `pages` — array of `{ pageNumber, text, confidence }`
   - `fields` — `{ fieldName: { value, confidence, source, page, raw } }`

**This is literally "convert files to JSON and store in DB."** It happens automatically and asynchronously after every upload.

### Constraints today
- Only files **≤ 10 MB** enter the pipeline (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`, line 31). Larger files skip extraction entirely.
- Extraction is capped at ~25 s per document (timeout race, line 143-148).
- The `fields` schema is **document-type-specific** (PAN, Aadhaar, GST, ITR, Bank Statement, Balance Sheet) — there is no single universal JSON schema that all formats map to.

So the question becomes: **do you want to also store the raw binary file content in the DB**, or are you asking why we don't have a *unified* JSON representation across all formats?

---

## Option A: Store Raw File Content (Binary-as-JSON) in PostgreSQL

### What this means
Instead of keeping the file in S3 and only storing extracted data in the DB, you'd store the **entire file** inside PostgreSQL — either as a binary `BYTEA` column or as a base64-encoded string inside `JSONB`.

### Why it's a bad idea for this app

| Problem | Detail |
|---|---|
| **5 GB ceiling** | `MAX_DOCUMENT_SIZE_BYTES = 5 GB`. PostgreSQL's effective row limit is ~1.6 GB (TOAST). You physically cannot store a 5 GB file as a single row/column. JSONB base64 would explode to ~6.7 GB and still exceed limits. |
| **DB cost** | Backblaze B2 charges ~$0.005–0.01/GB/month. Render PostgreSQL is ~$0.20/GB/mo provisioned. Storing 1 TB of documents in DB costs **20–40× more** than S3. |
| **Backup/restore time** | pg_dump of 1 TB takes hours and locks tables. Restoring = same. S3 restores are instant (it's object storage). |
| **Migration pain** | If you ever resize the DB, migrating multi-GB rows is brutal. With S3, you migrate metadata and change bucket configs. |
| **Connection timeouts** | Streaming a 5 GB blob through a Prisma query will hit request timeouts, connection pool exhaustion, and memory pressure on the Node.js server. |
| **Redundancy** | S3 is already 11×9 durability. PostgreSQL is 3×9 by default. You'd be *reducing* durability by moving data from S3 into the DB. |
| **Caching benefit lost** | S3 presigned URLs enable CDN caching and range requests. DB blobs can't be CDN'd. |

### Verdict for Option A: **Do not store raw binaries in the DB.** Keep files in S3/B2. This is the correct separation of concerns and is already implemented correctly.

---

## Option B: A Unified JSON Schema for All Extracted Form Data

### What this means
Instead of (or in addition to) the type-specific `fields` extraction, produce a **single canonical JSON structure** that any file format can be normalized into, so downstream code (form autofill) only needs to know one shape.

### Why it's a good idea — and it's half-built already

The `DocumentExtraction` model already stores `fields` as generic `Json`, and `AutoFillService` (`autoFillService.ts`) already consumes those fields to populate wizard steps. The gap is that:

1. Each `DocumentType` extractor (`panExtractor.ts`, `bankStatementExtractor.ts`, etc.) returns fields with **different key names** — there's no shared schema.
2. `UNKNOWN` document types get **no field extraction** (the fallback loop in `extractionPipeline.ts:233-244` only kicks in for regex, and only if at least one extractor returns a match).
3. Files > 10 MB are **never parsed at all** — their `DocumentExtraction` row stays in `processing`/`failed` or is never created.

### How to implement a unified schema

**Step 1 — Define a canonical form**
Add a new table or extend `DocumentExtraction`:

```prisma
model DocumentData {
  id            String   @id @default(cuid())
  documentId    String   @unique
  document      Document @relation(fields: [documentId], references: [id])
  canonicalJson Json     // { entities: [], tables: [], key_values: [], signatures: [] }
  rawSchema     String   // which parser produced this (pdf, docx, xlsx, ocr)
  createdAt     DateTime @default(now())
}
```

Canonical JSON shape proposal:
```json
{
  "entities": [
    { "label": "PAN Number", "value": "ABCDE1234F", "confidence": 0.95, "bbox": [x,y,w,h], "page": 1 }
  ],
  "tables": [
    { "headers": ["Date","Credit","Debit","Balance"], "rows": [["01-04-24","50000","", "75000"]], "page": 2 }
  ],
  "key_values": [
    { "label": "Borrower Name", "value": "Acme Pvt Ltd", "confidence": 0.88, "page": 1 }
  ],
  "signatures": [
    { "page": 1, "coordinates": [x,y,w,h] }
  ]
}
```

**Step 2 — Generic parser layer**
The `ParserRegistry` already produces `ParsedDocument` (with `pages` text + `rawText`). Add a **generic normalizer** that, regardless of document type, always emits entities/tables/key_values. This means:
- Extend `OfficeParser` to parse tables from XLSX/CSV natively (already using `xlsx`).
- Extend `PdfParser` to use `pdfjs-dist` or `pdf-table-extractor` for table detection (currently only extracts text + OCR).
- For OCR images, `tesseract` can do block/level word-level bounding boxes — use them for `entities`.

**Step 3 — Handle large files**
The 10 MB extraction cap is the biggest gap. Lift it by:
- Streaming from S3 in chunks rather than `Buffer.concat`.
- For files > 10 MB, downsample images / rasterize PDF pages to lower DPI before OCR.
- Or: skip full extraction for >10 MB files but still record file-level metadata (page count, detected type, thumbnail of first page) so the form engine has *something* to work with.

**Step 4 — Wire into AutoFill**
`AutoFillService` currently maps `DocumentType` → specific field keys. Refactor it to read from the unified `canonicalJson` and map generic `entities` by label → form field, with fuzzy matching.

### Cost/benefit

| | Effort | Benefit |
|---|---|---|
| Canonical JSON schema | Medium (1–2 days for schema + Prisma) | High — one consumer shape for all formats |
| Generic parser/normalizer | Medium (2–4 days) | High — extracts tables/signatures from everything |
| Large-file handling | High (3–5 days) | Medium — covers >10 MB files that currently skip extraction |
| Refactoring AutoFillService | Medium (2–3 days) | High — single mapping logic |

---

## Option C: Keep the Current Two-Tier Design (Recommended)

The current design is actually the **industry-standard pattern**:

```
[Raw file] → S3/B2 object storage        ← durable, cheap, scalable
              ↓ (triggered on upload)
[Extracted JSON] → PostgreSQL DocumentExtraction ← queryable, indexable
```

This separates **durable binary storage** (S3) from **queryable structured data** (Postgres). You already have:
- Presigned upload URLs (no backend streaming) — `document.service.ts:30`
- Soft-delete lifecycle — Document marked `DELETED`, S3 delete best-effort — `document.service.ts:130+`
- Async extraction with caching — `extractionPipeline.ts:66`
- Background workers with concurrency limits — `processMany` line 133

### What to add incrementally
1. **Unified canonical JSON** as a new schema (Option B, Step 1–4) — builds on the existing extraction pipeline rather than replacing it.
2. **Lift the 10 MB cap** with chunked streaming.
3. **Generic normalizer** so even unclassified files yield key/value/table entities.

This gives you "all form information accessible as JSON from the DB" **without** the cost, complexity, and risk of storing binaries in PostgreSQL.

---

## Summary

Storing raw file binaries in the DB is **not a good idea** — it fails on size limits (5 GB > PostgreSQL row cap), costs 20–40× more than S3, and slows backups. The system already converts files to JSON and stores the structured result in `DocumentExtraction`. The right next step is **not** to put binaries in the DB but to evolve the existing extraction pipeline: introduce a unified canonical JSON schema, lift the 10 MB cap, and make the normalizer format-agnostic so every file type — even unclassified ones — yields queryable entities/tables/key-values from the database.

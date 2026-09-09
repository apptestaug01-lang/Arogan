# BusinessLoanApp — Gaps Analysis

> Generated: 2026-09-08  
> Scope: B2/S3 storage integration, document upload pipeline, document-to-JSON extraction utility  
> Bucket layout: `loanflow-documents / borrowers/{userId}/applications/{appId}/documents/{docId}/{fileName}`

---

## Storage & B2 Integration — What Is Correct

- `storage.config.ts` auto-detects B2 credentials and builds the correct S3-compatible endpoint (`s3.{region}.backblazeb2.com`)
- S3 client uses `forcePathStyle: true` and `requestChecksumCalculation: 'WHEN_REQUIRED'` — both required for B2 compatibility
- Bucket key layout matches the target path exactly
- Presign → Upload → Complete flow is correct; multipart is also implemented
- Archive keys go to `.loanflow/{docId}/document.json` — separate from borrower docs

---

## Gap Summary Table

| # | Gap | Area | Severity |
|---|-----|------|----------|
| 1 | `Document.size` typed as `Int` — overflows for files >2.1 GB | Backend / DB | 🔴 High |
| 2 | `documentType` not written back to `Document` row after extraction | Backend | 🔴 High |
| 3 | `INCORPORATION_CERT` regex extractor missing | Backend | 🔴 High |
| 4 | `SANCTION_LETTER` regex extractor missing | Backend | 🔴 High |
| 5 | Archive worker queue never processed — no scheduler trigger | Backend | 🔴 High |
| 6 | Folder drag-drop broken — `DataTransfer.files` does not traverse directories | Frontend | 🔴 High |
| 7 | No batch presign endpoint — 10 docs = 10 serial API calls | Backend | 🟡 Medium |
| 8 | Extraction stuck in `processing` on failure — no retry or timeout recovery | Backend | 🟡 Medium |
| 9 | `documentConverter.ts` OCR fallback not used by extraction pipeline | Backend | 🟡 Medium |
| 10 | PAN `father_name` regex too strict — requires newline, fails on OCR output | Backend | 🟡 Medium |
| 11 | Folder picker shows all file types — disallowed files show error toasts instead of silent skip | Frontend | 🟡 Medium |
| 12 | `filterAllowedFiles` is dead code — ZIP-extracted files bypass silent filtering | Frontend | 🟡 Medium |
| 13 | File input does not reset — same file cannot be re-selected after error or cancel | Frontend | 🟡 Medium |
| 14 | `applicationId` has no FK constraint — silent orphan document risk | Backend / DB | 🟠 Low |

---

## Gap Details & Implementation

---

### Gap 1 — `Document.size` Int overflow

**File:** `backend/prisma/schema.prisma`

PostgreSQL `Int` is 32-bit (max ~2.1 GB). The upload limit is 5 GB. A file between 2.1 GB and 5 GB will silently overflow or throw a Prisma error at the `completeDocument` step.

**Fix — change `size Int` to `size BigInt`:**

```prisma
model Document {
  id            String         @id
  userId        String
  user          User           @relation(fields: [userId], references: [id])
  applicationId String
  category      String?
  documentType  String?        // also add this — see Gap 2
  s3Key         String         @unique
  originalName  String
  contentType   String
  size          BigInt         // ← was: Int
  checksum      String
  status        DocumentStatus @default(PENDING)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  extraction    DocumentExtraction?
  documentArchive DocumentArchive?

  @@index([userId])
  @@index([applicationId])
}
```

```bash
npx prisma migrate dev --name add-document-type-bigint
```

---

### Gap 2 — `documentType` not written back to `Document`

**File:** `backend/src/modules/documentExtraction/extractionPipeline.ts`

`category` is hardcoded to `'Documents'` at upload time. The actual document type (PAN_CARD, AADHAAR, etc.) is only known after extraction runs, but is never written back to the `Document` table — only stored in `DocumentExtraction.documentType`.

**Fix — add write-back after extraction update:**

```typescript
// In ExtractionPipeline.processDocument(), after prisma.documentExtraction.update() succeeds:

await this.prisma.document.update({
  where: { id: doc.id },
  data: { documentType: classification.type },
}).catch((err) => {
  logger.warn(
    { documentId: doc.id, err },
    '[ExtractionPipeline] failed to write documentType back to Document',
  );
});
```

---

### Gap 3 — `INCORPORATION_CERT` extractor missing

**File to create:** `backend/src/modules/documentExtraction/extractors/incorporationExtractor.ts`

The classifier detects `INCORPORATION_CERT` but no regex extractor exists. Only LLM (if configured) extracts fields — regex fallback returns zero fields.

```typescript
import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const clean = (v: string) => v.replace(/\s+/g, ' ').trim();

export class IncorporationCertExtractor implements Extractor {
  readonly documentType = 'INCORPORATION_CERT';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    // CIN: U/L + 5 digits + 2 alpha + 4 digits + 3 alpha + 6 digits
    const cinMatch = text.match(/([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})/);
    if (cinMatch) {
      fields.cin = {
        value: cinMatch[1],
        confidence: 0.99,
        source: fileName,
        raw: cinMatch[0],
      };
    }

    // Company name
    const namePatterns = [
      /(?:Name\s*of\s*(?:the\s*)?Company|Company\s*Name)\s*[:\n]\s*([A-Z][A-Za-z0-9\s&.,()-]+(?:LIMITED|LLP|PRIVATE|PVT\.?\s*LTD\.?))/i,
      /certify\s+that\s+([A-Z][A-Za-z0-9\s&.,()-]+(?:LIMITED|LLP|PRIVATE|PVT\.?\s*LTD\.?))/i,
    ];
    for (const p of namePatterns) {
      const m = text.match(p);
      if (m?.[1]) {
        const name = clean(m[1]);
        if (name.length > 3) {
          fields.companyName = { value: name, confidence: 0.9, source: fileName, raw: m[0] };
          break;
        }
      }
    }

    // Date of incorporation
    const doiPatterns = [
      /(?:Date\s*of\s*Incorporation|Incorporated\s*on)\s*[:\n]?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i,
      /(\d{2}[/-]\d{2}[/-]\d{4})/,
    ];
    for (const p of doiPatterns) {
      const m = text.match(p);
      if (m) {
        fields.dateOfIncorporation = { value: m[1], confidence: 0.85, source: fileName, raw: m[0] };
        break;
      }
    }

    // Business type
    const bizMatch = text.match(
      /(Private\s*Limited|Public\s*Limited|LLP|One\s*Person\s*Company|Proprietorship|Partnership)/i,
    );
    if (bizMatch) {
      fields.businessType = {
        value: clean(bizMatch[1]),
        confidence: 0.9,
        source: fileName,
        raw: bizMatch[0],
      };
    }

    // Signatory
    const sigMatch = text.match(
      /(?:Registrar|Authorized\s*Signatory|Signed\s*by)\s*[:\n]?\s*([A-Z][A-Za-z\s.]+)/i,
    );
    if (sigMatch?.[1]) {
      const sig = clean(sigMatch[1]);
      if (sig.length > 3) {
        fields.signatory = { value: sig, confidence: 0.75, source: fileName, raw: sigMatch[0] };
      }
    }

    return fields;
  }
}
```

**Register in `extractors/index.ts`:**

```typescript
import { IncorporationCertExtractor } from './incorporationExtractor.js';
// add to registry array:
new IncorporationCertExtractor(),
```

---

### Gap 4 — `SANCTION_LETTER` extractor missing

**File to create:** `backend/src/modules/documentExtraction/extractors/sanctionLetterExtractor.ts`

```typescript
import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const parseNum = (v: string) => {
  const n = parseFloat(v.replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
};

export class SanctionLetterExtractor implements Extractor {
  readonly documentType = 'SANCTION_LETTER';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    // Loan amount — normalize lakhs/crores
    const amtPatterns = [
      /(?:Loan\s*Amount|Sanctioned\s*Amount|Credit\s*Limit|Facility\s*Amount)\s*[:\n]?\s*₹?\s*([\d,.\s]+(?:Lakhs?|Crores?|Cr\.?)?)/i,
      /(?:Amount\s*of\s*(?:Loan|Facility))\s*[:\n]?\s*₹?\s*([\d,.\s]+)/i,
    ];
    for (const p of amtPatterns) {
      const m = text.match(p);
      if (m) {
        const raw = m[1].trim();
        let val = parseNum(raw.replace(/Lakhs?/i, '').replace(/Crores?|Cr\.?/i, ''));
        if (val !== null) {
          if (/Crore/i.test(raw)) val *= 10_000_000;
          else if (/Lakh/i.test(raw)) val *= 100_000;
          fields.loanAmount = { value: val, confidence: 0.9, source: fileName, raw: m[0] };
          break;
        }
      }
    }

    // Tenor (months)
    const tenorMatch = text.match(
      /(?:Tenor|Tenure|Repayment\s*Period)\s*[:\n]?\s*(\d+)\s*(?:Months?|Years?)/i,
    );
    if (tenorMatch) {
      let months = parseInt(tenorMatch[1], 10);
      if (/Year/i.test(tenorMatch[0])) months *= 12;
      fields.tenor = { value: months, confidence: 0.88, source: fileName, raw: tenorMatch[0] };
    }

    // Interest rate
    const rateMatch = text.match(
      /(?:Interest\s*Rate|Rate\s*of\s*Interest|ROI)\s*[:\n]?\s*([\d.]+)\s*%?\s*(?:p\.?a\.?|per\s*annum)?/i,
    );
    if (rateMatch) {
      const rate = parseNum(rateMatch[1]);
      if (rate !== null) {
        fields.interestRate = { value: rate, confidence: 0.9, source: fileName, raw: rateMatch[0] };
      }
    }

    // Product type
    const productMatch = text.match(
      /(Term\s*Loan|Working\s*Capital|Project\s*Finance|LC\/BG|Cash\s*Credit|Overdraft)/i,
    );
    if (productMatch) {
      fields.productType = {
        value: productMatch[1],
        confidence: 0.85,
        source: fileName,
        raw: productMatch[0],
      };
    }

    // Purpose
    const purposeMatch = text.match(/(?:Purpose|End\s*Use)\s*[:\n]\s*([^\n.]+)/i);
    if (purposeMatch?.[1]) {
      fields.purpose = {
        value: purposeMatch[1].trim(),
        confidence: 0.8,
        source: fileName,
        raw: purposeMatch[0],
      };
    }

    // Collateral
    const collateralMatch = text.match(/(?:Collateral|Security|Mortgage)\s*[:\n]\s*([^\n.]+)/i);
    if (collateralMatch?.[1]) {
      fields.collateral = {
        value: collateralMatch[1].trim(),
        confidence: 0.75,
        source: fileName,
        raw: collateralMatch[0],
      };
    }

    return fields;
  }
}
```

**Register in `extractors/index.ts`:**

```typescript
import { SanctionLetterExtractor } from './sanctionLetterExtractor.js';
// add to registry array:
new SanctionLetterExtractor(),
```

---

### Gap 5 — Archive worker queue never processed

**File:** `backend/src/modules/documentArchive/scheduler.ts`

`archiveWorker.enqueue()` is called in `completeDocument()` but `archiveWorker.process()` is never triggered. The queue grows indefinitely and no documents are ever archived.

**Fix — replace/update scheduler.ts:**

```typescript
import { archiveWorker } from './worker.js';
import logger from '../../middleware/logger.js';

const POLL_INTERVAL_MS = 5_000;

let timer: NodeJS.Timeout | null = null;

export function startArchiveScheduler(): void {
  if (timer) return;
  logger.info('[ArchiveScheduler] Starting — polling every 5 s');
  const tick = async () => {
    try {
      await archiveWorker.process();
    } catch (err) {
      logger.error({ err }, '[ArchiveScheduler] tick error');
    } finally {
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };
  timer = setTimeout(tick, POLL_INTERVAL_MS);
}

export function stopArchiveScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    logger.info('[ArchiveScheduler] Stopped');
  }
}
```

**Wire into server startup (`backend/src/server.ts` or `app.ts`):**

```typescript
import { startArchiveScheduler } from './modules/documentArchive/scheduler.js';

// after app.listen():
startArchiveScheduler();
```

---

### Gap 6 — Folder drag-drop broken

**File:** `frontend/src/lib/upload/fileProcessor.ts`

`handleDrop` calls `handleFiles(e.dataTransfer.files)` but `DataTransfer.files` from a folder drop only contains the folder object itself (zero-byte) in most browsers, or all files flat in Chrome — no recursive traversal. The fix uses the `FileSystemEntry` / `webkitGetAsEntry()` API.

**Add to `fileProcessor.ts`:**

```typescript
export async function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

export async function traverseEntry(
  entry: FileSystemEntry,
  path = '',
): Promise<ProcessedFile[]> {
  if (entry.isFile) {
    const file = await readEntryAsFile(entry as FileSystemFileEntry);
    const relativePath = path ? `${path}/${file.name}` : file.name;
    return [{ file, originalName: file.name, size: file.size, relativePath }];
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const results: ProcessedFile[] = [];

    // readEntries returns max 100 at a time — must loop until empty
    const readAll = (): Promise<FileSystemEntry[]> =>
      new Promise((resolve, reject) => {
        const all: FileSystemEntry[] = [];
        const read = () => {
          reader.readEntries((entries) => {
            if (entries.length === 0) return resolve(all);
            all.push(...entries);
            read();
          }, reject);
        };
        read();
      });

    const entries = await readAll();
    const folderPath = path ? `${path}/${entry.name}` : entry.name;
    for (const child of entries) {
      const childFiles = await traverseEntry(child, folderPath);
      results.push(...childFiles);
    }
    return results;
  }

  return [];
}

export async function processDroppedItems(
  dataTransfer: DataTransfer,
): Promise<ProcessedFile[]> {
  const items = Array.from(dataTransfer.items);
  const hasEntryAPI =
    items.length > 0 && typeof items[0].webkitGetAsEntry === 'function';

  if (!hasEntryAPI) {
    // Fallback for browsers without FileSystem API
    return processUploadInput(dataTransfer.files);
  }

  const results: ProcessedFile[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (!entry) continue;
    const files = await traverseEntry(entry);
    results.push(...files);
  }

  // Expand ZIPs found inside dropped folders
  const final: ProcessedFile[] = [];
  for (const pf of results) {
    if (isZipFile(pf.file)) {
      const extracted = await extractZipFiles(pf.file);
      final.push(...extracted);
    } else {
      final.push(pf);
    }
  }
  return final;
}
```

**Update `handleDrop` in `FileDropzone.tsx`:**

```typescript
import { processDroppedItems } from '@/lib/upload/fileProcessor';

const handleDrop = React.useCallback(
  async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const processed = await processDroppedItems(e.dataTransfer);
    const items = addUploadItems(processed);
    items.forEach(startUpload);
  },
  [addUploadItems, startUpload],
);
```

---

### Gap 7 — No batch presign endpoint

**File:** `backend/src/routes/documents.routes.ts`

Uploading 10 documents requires 10 sequential presign API calls from the frontend.

**Add after the `/presign` route:**

```typescript
router.post(
  '/presign-batch',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { files, applicationId } = req.body as {
        files: Array<{ fileName: string; contentType: string; contentLength: number }>;
        applicationId?: string;
      };

      if (!Array.isArray(files) || files.length === 0 || files.length > 20) {
        sendError(res, 'files must be a non-empty array of up to 20 items', 400);
        return;
      }

      const results = await Promise.allSettled(
        files.map((f) =>
          presignDocument({
            userId: req.user!.id,
            applicationId,
            fileName: f.fileName,
            contentType: f.contentType,
            contentLength: f.contentLength,
          }),
        ),
      );

      const response = results.map((r, i) =>
        r.status === 'fulfilled'
          ? { ...r.value, fileName: files[i].fileName, error: null }
          : { fileName: files[i].fileName, error: (r.reason as Error).message },
      );

      sendSuccess(res, 'Batch presign complete', { files: response });
    } catch (err) {
      next(err);
    }
  },
);
```

---

### Gap 8 — Extraction stuck in `processing` on failure

**File:** `backend/src/utils/triggerExtraction.ts`

`triggerExtraction` is fire-and-forget. If it fails (LLM timeout, S3 error), the `DocumentExtraction` row stays in `processing` status forever with no retry.

**Replace `triggerExtraction.ts`:**

```typescript
import { prisma } from '../lib/prisma.js';
import logger from '../middleware/logger.js';

export async function triggerExtraction(
  userId: string,
  documentId: string,
  retries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { AutoFillService } = await import('../modules/documentExtraction/autoFillService.js');
      const svc = new AutoFillService();
      await svc.extractFromDocument(userId, documentId);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ documentId, attempt, err: msg }, '[triggerExtraction] attempt failed');
      if (attempt === retries) {
        await prisma.documentExtraction
          .updateMany({
            where: { documentId, status: 'processing' },
            data: { status: 'failed', error: `All ${retries} attempts failed: ${msg}` },
          })
          .catch(() => {});
      } else {
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // exponential backoff
      }
    }
  }
}
```

---

### Gap 9 — `documentConverter.ts` OCR fallback not used by extraction pipeline

**File:** `backend/src/modules/documentExtraction/extractionPipeline.ts`

`documentConverter.ts` has OCR fallback via Tesseract + sharp preprocessing for scanned PDFs and images. The extraction pipeline uses its own `ParserRegistry` which duplicates this logic but without the same quality. The two implementations should share the converter.

**Fix — in `ExtractionPipeline.fetchAndParse()`, delegate to `convertDocument`:**

```typescript
import { convertDocument } from '../../utils/documentConverter.js';

private async fetchAndParse(doc: PipelineDocumentInput): Promise<ParsedDocument> {
  // ... existing size check and S3 fetch ...

  const converted = await convertDocument(body, contentType, doc.originalName, doc.s3Key, {
    size: body.length,
    checksum: '',
  });

  const rawText = converted.rawText ?? '';
  const pages = (converted.pages ?? []).map((p, i) => ({
    pageNumber: typeof p.pageNumber === 'number' ? p.pageNumber : i + 1,
    text: typeof p.text === 'string' ? p.text : '',
  }));

  return {
    documentId: doc.id,
    fileName: doc.originalName,
    contentType,
    rawText: rawText.slice(0, MAX_RAW_TEXT_CHARS),
    pages,
  };
}
```

---

### Gap 10 — PAN `father_name` regex too strict

**File:** `backend/src/modules/documentExtraction/extractors/panExtractor.ts`

The pattern `/Father'?s?\s*Name\s*\n+([A-Z][A-Za-z\s]+)/i` requires one or more newlines after "Father's Name". Real OCR output often has spaces or mixed whitespace.

**Fix — broaden the pattern:**

```typescript
// Replace:
const fatherMatch = text.match(/Father'?s?\s*Name\s*\n+([A-Z][A-Za-z\s]+)/i);

// With:
const fatherMatch = text.match(/Father'?s?\s*Name\s*[\s\n:]+([A-Z][A-Za-z\s]{2,40})/i);
```

Also add a second fallback pattern for when the name appears on the same line:

```typescript
const fatherPatterns = [
  /Father'?s?\s*Name\s*[\s\n:]+([A-Z][A-Za-z\s]{2,40})/i,
  /(?:S\/O|D\/O|W\/O)[:\s]+([A-Z][A-Za-z\s]{2,40})/i,
];

for (const pattern of fatherPatterns) {
  const fatherMatch = text.match(pattern);
  if (fatherMatch?.[1]) {
    const cleaned = cleanValue(fatherMatch[1]);
    if (cleaned.length > 3 && !NAME_BLOCKLIST.test(cleaned)) {
      fields.father_name = {
        value: cleaned,
        confidence: 0.8,
        source: fileName,
        raw: fatherMatch[0],
      };
      break;
    }
  }
}
```

---

### Gap 11 — Folder picker: disallowed files show error toasts instead of silent skip

**File:** `frontend/src/components/workspace/FileDropzone.tsx`

When a user picks a folder, files with unsupported types (`.DS_Store`, `Thumbs.db`, etc.) trigger error toasts via `validateProcessedFile`. These should be silently filtered.

**Fix — add a separate `handleFolderInput` handler:**

```typescript
import { isAllowedFileType } from '@/constants/documents';

const handleFolderInput = React.useCallback(
  async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const folderPrefix = (() => {
      const first = e.target.files[0]?.webkitRelativePath ?? '';
      const slash = first.indexOf('/');
      return slash >= 0 ? first.substring(0, slash + 1) : '';
    })();
    const processed = await processUploadInput(e.target.files, folderPrefix);
    // Silent filter — no error toasts for unsupported types from folder picks
    const allowed = processed.filter(({ file }) => isAllowedFileType(file));
    const items = addUploadItems(allowed);
    items.forEach(startUpload);
    e.target.value = ''; // reset so same folder can be re-selected
  },
  [addUploadItems, startUpload],
);
```

**Update folder input JSX:**

```tsx
<input
  ref={folderInputRef}
  type="file"
  multiple
  // No accept attr — OS shows all files, we filter silently above
  className="hidden"
  onChange={handleFolderInput}
/>
```

---

### Gap 12 — `filterAllowedFiles` is dead code

**File:** `frontend/src/lib/upload/fileProcessor.ts`

`filterAllowedFiles` is exported but never called inside `processUploadInput`. ZIP-extracted files skip the type check entirely until `validateProcessedFile` runs later, which shows an error toast per file.

**Fix — call `filterAllowedFiles` on ZIP-extracted files inside `processUploadInput`:**

```typescript
export async function processUploadInput(
  input: FileList | null,
  folderPrefix?: string,
): Promise<ProcessedFile[]> {
  if (!input || input.length === 0) return [];

  const rawFiles: File[] = [];
  const zipFiles: File[] = [];

  for (let i = 0; i < input.length; i++) {
    const file = input[i];
    if (isZipFile(file)) zipFiles.push(file);
    else rawFiles.push(file);
  }

  const processed: ProcessedFile[] = [];

  for (const file of rawFiles) {
    processed.push({
      file,
      originalName: file.name,
      size: file.size,
      relativePath: getRelativePath(file, folderPrefix),
    });
  }

  for (const zipFile of zipFiles) {
    const extracted = await extractZipFiles(zipFile);
    // Silent filter for ZIP contents — user didn't explicitly pick each file
    processed.push(...filterAllowedFiles(extracted));
  }

  return processed;
}
```

---

### Gap 13 — File input does not reset after error or cancel

**File:** `frontend/src/components/workspace/FileDropzone.tsx`

After a failed upload, if the user tries to pick the same file again via "Choose files", the `onChange` event does not fire because the input value has not changed.

**Fix — reset input value after processing:**

```typescript
const handleFileInput = React.useCallback(
  async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    e.target.value = ''; // reset so same file can be re-selected
  },
  [handleFiles],
);

// Update file input JSX:
<input
  ref={fileInputRef}
  type="file"
  multiple
  accept={ACCEPTED_EXT}
  className="hidden"
  onChange={handleFileInput}
/>
```

---

### Gap 14 — `applicationId` has no FK constraint

**File:** `backend/prisma/schema.prisma`

`Document.applicationId` is a plain `String` with no foreign key to `Application`. A document uploaded with a real `applicationId` that does not exist yet will not fail — creating silent orphan documents.

**Fix — add optional relation (allows `standalone` default to remain valid):**

```prisma
model Document {
  // ...
  applicationId String
  application   Application? @relation(fields: [applicationId], references: [applicationId])
  // ...
}

model Application {
  // ...
  documents     Document[]
  // ...
}
```

> Note: the `standalone` sentinel value will not match any `Application` row. If you want strict enforcement, replace the sentinel with `null` and make `applicationId` optional (`String?`).

---

## Files to Create / Modify

| Action | File |
|--------|------|
| Modify | `backend/prisma/schema.prisma` |
| Modify | `backend/src/modules/documentExtraction/extractionPipeline.ts` |
| **Create** | `backend/src/modules/documentExtraction/extractors/incorporationExtractor.ts` |
| **Create** | `backend/src/modules/documentExtraction/extractors/sanctionLetterExtractor.ts` |
| Modify | `backend/src/modules/documentExtraction/extractors/index.ts` |
| Modify | `backend/src/modules/documentArchive/scheduler.ts` |
| Modify | `backend/src/server.ts` |
| Modify | `backend/src/utils/triggerExtraction.ts` |
| Modify | `backend/src/routes/documents.routes.ts` |
| Modify | `backend/src/modules/documentExtraction/extractors/panExtractor.ts` |
| Modify | `frontend/src/lib/upload/fileProcessor.ts` |
| Modify | `frontend/src/components/workspace/FileDropzone.tsx` |

import { FIELD_DEFINITIONS, FIELD_KEYS } from './fields';
import { extractField, makeSnippet } from './heuristics';
import type {
  ApplicationDraftKey,
  Confidence,
  DocumentTextSource,
  ExtractionResult,
  ExtractedField,
} from './types';

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

function snippetFor(text: string, value: string): string {
  const idx = text.toLowerCase().indexOf(value.toLowerCase());
  if (idx >= 0) return makeSnippet(text, idx, value.length);
  return makeSnippet(text, 0, 0);
}

// Pure orchestrator: given extracted text from each vault document, fill every
// application field. Selection honours each field's category affinity (most
// relevant document type first) and keeps the highest-confidence match.
export function extractFromTextSources(sources: DocumentTextSource[]): ExtractionResult {
  const byCategory = new Map<string, DocumentTextSource[]>();
  for (const src of sources) {
    const list = byCategory.get(src.category) ?? [];
    list.push(src);
    byCategory.set(src.category, list);
  }

  const fields: Partial<Record<ApplicationDraftKey, ExtractedField>> = {};

  for (const def of FIELD_DEFINITIONS) {
    const ordered: DocumentTextSource[] = [];
    for (const cat of def.affinity) {
      const list = byCategory.get(cat);
      if (list) ordered.push(...list);
    }
    for (const [cat, list] of byCategory) {
      if (!def.affinity.includes(cat)) ordered.push(...list);
    }

    let best: ExtractedField | null = null;
    for (const src of ordered) {
      const result = extractField(def, src.text);
      if (!result) continue;
      if (!best || CONFIDENCE_RANK[result.confidence] > CONFIDENCE_RANK[best.confidence]) {
        best = {
          value: result.value,
          confidence: result.confidence,
          source: {
            docId: src.docId,
            docName: src.docName,
            category: src.category,
            snippet: snippetFor(src.text, result.value),
          },
        };
      }
    }

    if (best) fields[def.key] = best;
  }

  const values: Partial<Record<ApplicationDraftKey, string>> = {};
  for (const key of FIELD_KEYS) {
    if (fields[key]) values[key] = fields[key]!.value;
  }

  const missing = FIELD_KEYS.filter((k) => !fields[k]);

  return { values: values as ExtractionResult['values'], fields, missing };
}

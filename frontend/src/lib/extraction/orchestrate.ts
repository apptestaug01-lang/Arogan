import { FIELD_DEFINITIONS, FIELD_KEYS } from './fields';
import { extractField, makeSnippet } from './heuristics';
import { classifyDocuments } from './classifyDocuments';
import { extractByDocumentType } from './typeExtractors';
import { normalizeField } from './normalize';
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

function boostConfidence(confidence: Confidence, docType: string): Confidence {
  if (confidence === 'high') return 'high';
  const boosts: Record<string, string[]> = {
    pan: ['pan', 'aadhaar', 'fullName', 'email', 'mobile', 'address'],
    aadhaar: ['aadhaar', 'pan', 'fullName'],
    gst: ['companyName', 'cin', 'industry', 'gstin', 'companyPan', 'businessType'],
    itr: ['turnoverY1', 'turnoverY2', 'profitY1', 'profitY2'],
    bank_statement: ['avgMonthlyBalance', 'existingMonthlyEmi', 'avgMonthlyCredits', 'bankStatementPeriod'],
    company_pan: ['companyPan', 'companyName'],
    business_proof: ['companyName', 'cin', 'businessType', 'dateOfIncorporation', 'signatory', 'designation'],
  };
  const fields = boosts[docType] || [];
  if (fields.length > 0 && confidence === 'medium') return 'high';
  return confidence;
}

export function extractFromTextSources(sources: DocumentTextSource[]): ExtractionResult {
  const classified = classifyDocuments(sources);
  const fields: Partial<Record<ApplicationDraftKey, ExtractedField>> = {};

  for (const doc of classified) {
    const typeFields = extractByDocumentType(doc.type, doc.text);

    for (const [key, field] of Object.entries(typeFields)) {
      const draftKey = key as ApplicationDraftKey;
      const normalizedValue = normalizeField(draftKey, field.value);
      const boostedConfidence = boostConfidence(field.confidence, doc.type);

      if (!fields[draftKey] || CONFIDENCE_RANK[boostedConfidence] > CONFIDENCE_RANK[fields[draftKey]!.confidence]) {
        fields[draftKey] = {
          value: normalizedValue,
          confidence: boostedConfidence,
          source: {
            docId: doc.docId,
            docName: doc.docName,
            snippet: snippetFor(doc.text, normalizedValue),
          },
        };
      }
    }
  }

  for (const def of FIELD_DEFINITIONS) {
    if (fields[def.key]) continue;

    for (const doc of classified) {
      const result = extractField(def, doc.text);
      if (!result) continue;

      const boostedConfidence = boostConfidence(result.confidence, doc.type);
      if (!fields[def.key] || CONFIDENCE_RANK[boostedConfidence] > CONFIDENCE_RANK[fields[def.key]!.confidence]) {
        fields[def.key] = {
          value: normalizeField(def.key, result.value),
          confidence: boostedConfidence,
          source: {
            docId: doc.docId,
            docName: doc.docName,
            snippet: snippetFor(doc.text, result.value),
          },
        };
      }
    }
  }

  const values: Partial<Record<ApplicationDraftKey, string>> = {};
  for (const key of FIELD_KEYS) {
    if (fields[key]) values[key] = fields[key]!.value;
  }

  const missing = FIELD_KEYS.filter((k) => !fields[k]);

  return { values: values as ExtractionResult['values'], fields, missing };
}

export async function extractFromTextSourcesWithLlm(
  sources: DocumentTextSource[],
  llmExtract: (text: string, fieldLabels: string[]) => Promise<ExtractionResult['fields']>,
): Promise<ExtractionResult> {
  const regexResult = extractFromTextSources(sources);
  const missingFields = regexResult.missing;

  if (missingFields.length === 0) {
    return regexResult;
  }

  try {
    const combinedText = sources.map((s) => `[${s.docName}]\n${s.text}`).join('\n\n---\n\n');
    const missingLabels = missingFields.map((k) => FIELD_DEFINITIONS.find((d) => d.key === k)?.label || k).filter(Boolean);

    if (missingLabels.length === 0) return regexResult;

    const llmFields = await llmExtract(combinedText, missingLabels);

    const mergedFields = { ...regexResult.fields };
    const mergedValues: Partial<Record<ApplicationDraftKey, string>> = { ...regexResult.values };

    for (const [key, field] of Object.entries(llmFields)) {
      const draftKey = key as ApplicationDraftKey;
      if (!mergedFields[draftKey]) {
        const normalizedValue = normalizeField(draftKey, field.value);
        mergedFields[draftKey] = {
          ...field,
          value: normalizedValue,
          confidence: 'medium',
        };
        mergedValues[draftKey] = normalizedValue;
      }
    }

    return {
      values: mergedValues,
      fields: mergedFields,
      missing: FIELD_KEYS.filter((k) => !mergedFields[k]),
    };
  } catch (error) {
    console.error('LLM fallback failed:', error);
    return regexResult;
  }
}

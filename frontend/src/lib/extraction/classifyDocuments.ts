import type { DocumentTextSource } from './types';

export type DocumentType =
  | 'pan'
  | 'aadhaar'
  | 'gst'
  | 'itr'
  | 'bank_statement'
  | 'company_pan'
  | 'business_proof'
  | 'unknown';

export interface ClassifiedDocument extends DocumentTextSource {
  type: DocumentType;
  confidence: number;
}

const FILENAME_PATTERNS: Record<DocumentType, RegExp[]> = {
  pan: [
    /pan/i,
    /permanent\s*account/i,
  ],
  aadhaar: [
    /aadhaar/i,
    /aadhar/i,
    /uid/i,
  ],
  gst: [
    /gst/i,
    /gstr/i,
    /gstin/i,
  ],
  itr: [
    /itr/i,
    /income\s*tax/i,
    /return/i,
  ],
  bank_statement: [
    /bank/i,
    /statement/i,
    /account/i,
  ],
  company_pan: [
    /company\s*pan/i,
    /corporate\s*pan/i,
  ],
  business_proof: [
    /business/i,
    /incorporation/i,
    /cin/i,
    /company/i,
    /registration/i,
  ],
  unknown: [],
};

const CONTENT_SIGNATURES: Record<DocumentType, RegExp[]> = {
  pan: [
    /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
    /permanent\s+account\s+number/i,
    /income\s+tax\s+department/i,
  ],
  aadhaar: [
    /\b[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\b/,
    /aadhaar/i,
    /uidai/i,
    /government\s+of\s+india/i,
  ],
  gst: [
    /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}\b/,
    /gstin/i,
    /gstr[-_]?3b/i,
    /goods\s+and\s+services\s+tax/i,
  ],
  itr: [
    /assessment\s+year/i,
    /itr/i,
    /income\s+from\s+business/i,
    /total\s+income/i,
    /tax\s+payable/i,
  ],
  bank_statement: [
    /account\s+number/i,
    /balance/i,
    /transaction/i,
    /debit|credit/i,
    /ifsc/i,
  ],
  company_pan: [
    /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
    /company\s+pan/i,
    /corporate\s+pan/i,
  ],
  business_proof: [
    /cin\b/i,
    /corporate\s+identity/i,
    /incorporation/i,
    /company\s+name/i,
    /registered\s+office/i,
  ],
  unknown: [],
};

function scoreFilename(filename: string): Record<DocumentType, number> {
  const scores: Record<DocumentType, number> = {
    pan: 0,
    aadhaar: 0,
    gst: 0,
    itr: 0,
    bank_statement: 0,
    company_pan: 0,
    business_proof: 0,
    unknown: 0,
  };

  for (const [type, patterns] of Object.entries(FILENAME_PATTERNS)) {
    if (type === 'unknown') continue;
    for (const pattern of patterns) {
      if (pattern.test(filename)) {
        scores[type as DocumentType] += 2;
      }
    }
  }

  return scores;
}

function scoreContent(text: string): Record<DocumentType, number> {
  const scores: Record<DocumentType, number> = {
    pan: 0,
    aadhaar: 0,
    gst: 0,
    itr: 0,
    bank_statement: 0,
    company_pan: 0,
    business_proof: 0,
    unknown: 0,
  };

  for (const [type, patterns] of Object.entries(CONTENT_SIGNATURES)) {
    if (type === 'unknown') continue;
    for (const pattern of patterns) {
      const matches = text.match(new RegExp(pattern.source, pattern.flags));
      if (matches) {
        scores[type as DocumentType] += matches.length;
      }
    }
  }

  return scores;
}

export function classifyDocument(doc: DocumentTextSource): ClassifiedDocument {
  const filenameScores = scoreFilename(doc.docName);
  const contentScores = scoreContent(doc.text);

  const combined: Record<DocumentType, number> = {
    pan: 0,
    aadhaar: 0,
    gst: 0,
    itr: 0,
    bank_statement: 0,
    company_pan: 0,
    business_proof: 0,
    unknown: 0,
  };

  for (const type of Object.keys(combined) as DocumentType[]) {
    if (type === 'unknown') continue;
    combined[type] = filenameScores[type] * 2 + contentScores[type];
  }

  let bestType: DocumentType = 'unknown';
  let bestScore = 0;

  for (const [type, score] of Object.entries(combined)) {
    if (type === 'unknown') continue;
    if (score > bestScore) {
      bestScore = score;
      bestType = type as DocumentType;
    }
  }

  const confidence = bestScore === 0 ? 0 : Math.min(bestScore / 10, 1);

  return {
    ...doc,
    type: bestType,
    confidence,
  };
}

export function classifyDocuments(docs: DocumentTextSource[]): ClassifiedDocument[] {
  return docs.map(classifyDocument);
}

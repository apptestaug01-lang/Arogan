export type DocumentType =
  | 'PAN_CARD'
  | 'AADHAAR'
  | 'GST_CERTIFICATE'
  | 'INCORPORATION_CERT'
  | 'ITR'
  | 'BANK_STATEMENT'
  | 'BALANCE_SHEET'
  | 'SANCTION_LETTER'
  | 'UNKNOWN';

export interface ClassifiedDocument {
  documentId: string;
  fileName: string;
  contentType: string;
  documentType: DocumentType;
  confidence: number;
}

export interface ExtractedField {
  value: string | number | boolean | string[];
  confidence: number;
  source: string;
  page?: number;
  raw?: string;
}

export interface ExtractionResult {
  documentId: string;
  fileName: string;
  documentType: DocumentType;
  fields: Record<string, ExtractedField>;
  rawText: string;
}

export interface ParsedDocument {
  documentId: string;
  fileName: string;
  contentType: string;
  pages: PageContent[];
  rawText: string;
}

export interface PageContent {
  pageNumber: number;
  text: string;
  confidence?: number;
}

export type WizardStep = 'kyc' | 'business' | 'financials' | 'loan';

export interface AutoFillResult {
  step: WizardStep;
  extractedFields: Record<string, ExtractedField>;
  unmatchedDocuments: string[];
  missingFields: string[];
}

export interface DocumentTypePattern {
  type: DocumentType;
  keywords: string[];
  patterns: RegExp[];
  fields: string[];
  step: WizardStep;
}

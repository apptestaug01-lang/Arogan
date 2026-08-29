// Shared types for the document -> application auto-fill utility.
// Kept framework-agnostic so the extractor is testable without the UI.

export interface ApplicationDraft {
  companyName: string;
  cin: string;
  industry: string;
  groupCompany: string;
  signatory: string;
  designation: string;
  loanAmount: string;
  productType: string;
  tenor: string;
  purpose: string;
  collateral: string;
  turnover: string;
  debt: string;
  netWorth: string;
}

export type ApplicationDraftKey = keyof ApplicationDraft;

export interface DocumentTextSource {
  docId: string;
  docName: string;
  category: string;
  text: string;
}

export interface FieldSource {
  docId: string;
  docName: string;
  category: string;
  snippet: string;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface ExtractedField {
  value: string;
  confidence: Confidence;
  source?: FieldSource;
}

export interface ExtractionResult {
  // Flat map of field key -> extracted value, ready to spread into the form.
  values: Partial<ApplicationDraft>;
  // Per-field detail including confidence and provenance.
  fields: Partial<Record<ApplicationDraftKey, ExtractedField>>;
  // Field keys that could not be found in any document.
  missing: ApplicationDraftKey[];
}

// Minimal shape of a vault document accepted by the orchestrator.
export interface VaultDocumentInput {
  id: string;
  originalName: string;
  category: string;
  contentType: string;
}

// Shared types for the document -> application auto-fill utility.
// Kept framework-agnostic so the extractor is testable without the UI.

export interface ApplicationDraft {
  // Step 1 — Personal & KYC
  fullName: string;
  pan: string;
  aadhaar: string;
  email: string;
  mobile: string;
  address: string;

  // Step 2 — Business Details
  companyName: string;
  cin: string;
  industry: string;
  groupCompany: string;
  signatory: string;
  designation: string;
  businessType: string;
  gstRegistered: boolean;
  gstin: string;
  companyPan: string;
  dateOfIncorporation: string;

  // Step 3 — Financials
  itrYears: string[];
  itrFiled: boolean[];
  turnoverY1: string;
  turnoverY2: string;
  profitY1: string;
  profitY2: string;
  bankStatementPeriod: string;
  avgMonthlyBalance: string;
  chequeBounces: number;
  existingMonthlyEmi: string;
  avgMonthlyCredits: string;
  netWorth: string;
  debt: string;

  // Step 4 — Loan Request
  loanAmount: string;
  productType: string;
  tenor: string;
  interestRate: string;
  purpose: string;
  collateral: string;

  // Legacy / auto-fill fields (kept for backward compatibility)
  turnover: string;
}

export type ApplicationDraftKey = keyof ApplicationDraft;

export interface DocumentTextSource {
  docId: string;
  docName: string;
  text: string;
}

export interface FieldSource {
  docId: string;
  docName: string;
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
  values: Partial<Record<ApplicationDraftKey, string>>;
  // Per-field detail including confidence and provenance.
  fields: Partial<Record<ApplicationDraftKey, ExtractedField>>;
  // Field keys that could not be found in any document.
  missing: ApplicationDraftKey[];
}

// Minimal shape of a vault document accepted by the orchestrator.
export interface VaultDocumentInput {
  id: string;
  originalName: string;
  contentType: string;
}

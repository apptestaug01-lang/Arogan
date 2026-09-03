import { DocumentType, WizardStep } from './types.js';

export const FIELD_STEP: Record<string, WizardStep> = {
  fullName: 'kyc',
  pan: 'kyc',
  aadhaar: 'kyc',
  email: 'kyc',
  mobile: 'kyc',
  address: 'kyc',
  dateOfBirth: 'kyc',
  gender: 'kyc',
  father_name: 'kyc',

  companyName: 'business',
  cin: 'business',
  businessType: 'business',
  industry: 'business',
  gstin: 'business',
  gstRegistered: 'business',
  dateOfIncorporation: 'business',
  signatory: 'business',
  designation: 'business',
  companyPan: 'business',
  groupCompany: 'business',

  turnoverY1: 'financials',
  turnoverY2: 'financials',
  profitY1: 'financials',
  profitY2: 'financials',
  avgMonthlyBalance: 'financials',
  avgMonthlyCredits: 'financials',
  bankStatementPeriod: 'financials',
  chequeBounces: 'financials',
  existingMonthlyEmi: 'financials',
  netWorth: 'financials',
  existingDebt: 'financials',
  turnover: 'financials',
  profit: 'financials',
  itrYears: 'financials',
  itrFiled: 'financials',

  loanAmount: 'loan',
  productType: 'loan',
  tenor: 'loan',
  interestRate: 'loan',
  purpose: 'loan',
  collateral: 'loan',
};

export const FIELD_SOURCES: Record<string, DocumentType[]> = {
  pan: ['PAN_CARD', 'ITR'],
  aadhaar: ['AADHAAR'],
  fullName: ['AADHAAR', 'PAN_CARD', 'ITR', 'INCORPORATION_CERT'],
  father_name: ['PAN_CARD', 'AADHAAR'],
  dateOfBirth: ['PAN_CARD', 'AADHAAR'],
  gender: ['AADHAAR', 'PAN_CARD'],
  address: ['AADHAAR', 'INCORPORATION_CERT', 'GST_CERTIFICATE'],

  companyName: ['INCORPORATION_CERT', 'PAN_CARD', 'GST_CERTIFICATE'],
  cin: ['INCORPORATION_CERT'],
  businessType: ['INCORPORATION_CERT', 'GST_CERTIFICATE'],
  industry: ['INCORPORATION_CERT'],
  gstin: ['GST_CERTIFICATE'],
  gstRegistered: ['GST_CERTIFICATE'],
  dateOfIncorporation: ['INCORPORATION_CERT'],
  signatory: ['INCORPORATION_CERT'],
  designation: ['INCORPORATION_CERT'],
  companyPan: ['PAN_CARD', 'INCORPORATION_CERT'],
  groupCompany: ['INCORPORATION_CERT'],

  turnover: ['ITR', 'BALANCE_SHEET'],
  profit: ['ITR', 'BALANCE_SHEET'],
  turnoverY1: ['BALANCE_SHEET', 'ITR'],
  turnoverY2: ['BALANCE_SHEET', 'ITR'],
  profitY1: ['BALANCE_SHEET', 'ITR'],
  profitY2: ['BALANCE_SHEET', 'ITR'],
  netWorth: ['BALANCE_SHEET'],
  existingDebt: ['BALANCE_SHEET', 'BANK_STATEMENT'],
  avgMonthlyBalance: ['BANK_STATEMENT'],
  avgMonthlyCredits: ['BANK_STATEMENT'],
  bankStatementPeriod: ['BANK_STATEMENT'],
  chequeBounces: ['BANK_STATEMENT'],
  existingMonthlyEmi: ['BANK_STATEMENT'],
  itrYears: ['ITR'],
  itrFiled: ['ITR'],

  loanAmount: ['SANCTION_LETTER'],
  productType: ['SANCTION_LETTER'],
  tenor: ['SANCTION_LETTER'],
  interestRate: ['SANCTION_LETTER'],
  purpose: ['SANCTION_LETTER'],
  collateral: ['SANCTION_LETTER'],
};

export function getStepForField(field: string): WizardStep | null {
  return FIELD_STEP[field] ?? null;
}

export function getFieldsForStep(step: WizardStep): string[] {
  return Object.entries(FIELD_STEP)
    .filter(([, s]) => s === step)
    .map(([f]) => f);
}

export function isKnownField(field: string): boolean {
  return field in FIELD_STEP;
}

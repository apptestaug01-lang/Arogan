// Single source of truth for wizard fields. The autofill pipeline, form
// components, and validation all read from this registry so the screens
// stay in sync with what the LLM/regex extractors know how to fill in.

import type { ApplicationDraft } from '@/types/application';
import type { WizardConstants } from '@/services/applications';

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select' | 'boolean' | 'multiselect';

export type WizardStep = 'kyc' | 'business' | 'financials' | 'loan';

export interface FieldDef {
  name: keyof ApplicationDraft;
  label: string;
  type: FieldType;
  step: WizardStep;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  minLength?: number;
  pattern?: string;
  rows?: number;
}

export const WIZARD_FIELDS: FieldDef[] = [
  // Step 1 - Personal & KYC
  { name: 'fullName', label: 'Full Name', type: 'text', step: 'kyc', required: true, placeholder: 'As on PAN card', pattern: "^[A-Za-z\\s\\-']+$" },
  { name: 'pan', label: 'PAN', type: 'text', step: 'kyc', required: true, placeholder: 'ABCDE1234F', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$' },
  { name: 'aadhaar', label: 'Aadhaar', type: 'text', step: 'kyc', required: true, placeholder: '12 digits', pattern: '^[0-9]{12}$' },
  { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', step: 'kyc', required: false, helpText: 'DD/MM/YYYY' },
  { name: 'gender', label: 'Gender', type: 'select', step: 'kyc', required: false, options: ['MALE', 'FEMALE', 'OTHER'] },
  { name: 'father_name', label: "Father's Name", type: 'text', step: 'kyc', required: false, placeholder: 'As on PAN card' },
  { name: 'email', label: 'Email', type: 'email', step: 'kyc', required: true, placeholder: 'you@example.com' },
  { name: 'mobile', label: 'Mobile', type: 'tel', step: 'kyc', required: true, placeholder: '9876543210', pattern: '^[6-9][0-9]{9}$' },
  { name: 'address', label: 'Address', type: 'textarea', step: 'kyc', required: true, rows: 3, placeholder: 'Full residential address' },

  // Step 2 - Business Details
  { name: 'companyName', label: 'Company Name', type: 'text', step: 'business', required: true, placeholder: 'Legal entity name' },
  { name: 'cin', label: 'CIN', type: 'text', step: 'business', required: false, placeholder: '21-char Corporate Identity Number', pattern: '^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$' },
  { name: 'companyPan', label: 'Company PAN', type: 'text', step: 'business', required: false, placeholder: 'AAACR1234A' },
  { name: 'businessType', label: 'Business Type', type: 'select', step: 'business', required: true, options: ['Private Limited', 'Public Limited', 'LLP', 'Proprietorship', 'Partnership'] },
  { name: 'industry', label: 'Industry', type: 'select', step: 'business', required: true, options: ['Infrastructure', 'Manufacturing', 'Renewable Energy', 'IT/ITES', 'Others'] },
  { name: 'groupCompany', label: 'Group Company', type: 'text', step: 'business', required: false, placeholder: 'Parent or affiliate entity (if any)' },
  { name: 'gstRegistered', label: 'GST Registered', type: 'boolean', step: 'business', required: false, helpText: 'Toggle on if the entity has a GSTIN' },
  { name: 'gstin', label: 'GSTIN', type: 'text', step: 'business', required: false, placeholder: '15-char GSTIN', pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', helpText: 'Required only if GST Registered is on' },
  { name: 'dateOfIncorporation', label: 'Date of Incorporation', type: 'date', step: 'business', required: false },
  { name: 'signatory', label: 'Authorised Signatory', type: 'text', step: 'business', required: false, placeholder: 'Full name' },
  { name: 'designation', label: 'Designation', type: 'text', step: 'business', required: false, placeholder: 'e.g. Director, CEO' },

  // Step 3 - Financials
  { name: 'turnoverY1', label: 'Turnover Year 1 (₹)', type: 'number', step: 'financials', required: true, placeholder: 'Last completed FY' },
  { name: 'turnoverY2', label: 'Turnover Year 2 (₹)', type: 'number', step: 'financials', required: true, placeholder: 'FY before last' },
  { name: 'profitY1', label: 'Profit Year 1 (₹)', type: 'number', step: 'financials', required: true },
  { name: 'profitY2', label: 'Profit Year 2 (₹)', type: 'number', step: 'financials', required: true },
  { name: 'bankStatementPeriod', label: 'Bank Statement Period', type: 'select', step: 'financials', required: false, options: ['3 months', '6 months', '12 months'] },
  { name: 'avgMonthlyBalance', label: 'Avg Monthly Balance (₹)', type: 'number', step: 'financials', required: true },
  { name: 'avgMonthlyCredits', label: 'Avg Monthly Credits (₹)', type: 'number', step: 'financials', required: false },
  { name: 'chequeBounces', label: 'Cheque Bounces (last 12 months)', type: 'number', step: 'financials', required: false },
  { name: 'existingMonthlyEmi', label: 'Existing Monthly EMI (₹)', type: 'number', step: 'financials', required: true },
  { name: 'netWorth', label: 'Net Worth (₹)', type: 'number', step: 'financials', required: false },
  { name: 'debt', label: 'Existing Debt (₹)', type: 'number', step: 'financials', required: false },
  { name: 'turnover', label: 'Current Year Turnover (₹)', type: 'number', step: 'financials', required: false, helpText: 'Estimated for the in-progress year' },
  { name: 'profit', label: 'Current Year Profit (₹)', type: 'number', step: 'financials', required: false, helpText: 'Estimated for the in-progress year' },
  { name: 'existingDebt', label: 'Total Existing Debt (₹)', type: 'number', step: 'financials', required: false },
  { name: 'itrYears', label: 'ITR Filed Years', type: 'multiselect', step: 'financials', required: false, options: ['AY 2022-23', 'AY 2023-24', 'AY 2024-25', 'AY 2025-26'] },
  { name: 'itrFiled', label: 'ITR Filed Status', type: 'multiselect', step: 'financials', required: false, options: ['YES', 'NO', 'PENDING'] },

  // Step 4 - Loan Request
  { name: 'loanAmount', label: 'Loan Amount (₹)', type: 'number', step: 'loan', required: true },
  { name: 'productType', label: 'Product Type', type: 'select', step: 'loan', required: true, options: ['Term Loan', 'Working Capital', 'Project Finance', 'LC/BG'] },
  { name: 'tenor', label: 'Tenor (months)', type: 'number', step: 'loan', required: true },
  { name: 'interestRate', label: 'Interest Rate (%)', type: 'number', step: 'loan', required: false },
  { name: 'purpose', label: 'Purpose', type: 'textarea', step: 'loan', required: true, minLength: 20, rows: 4, placeholder: 'At least 20 characters. What will the funds be used for?' },
  { name: 'collateral', label: 'Collateral', type: 'textarea', step: 'loan', required: true, minLength: 20, rows: 4, placeholder: 'At least 20 characters. Property, equipment, receivables, etc.' },
];

export const FIELD_BY_NAME: Record<string, FieldDef> = WIZARD_FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.name]: f }),
  {} as Record<string, FieldDef>,
);

export const FIELDS_BY_STEP: Record<WizardStep, FieldDef[]> = {
  kyc: WIZARD_FIELDS.filter((f) => f.step === 'kyc'),
  business: WIZARD_FIELDS.filter((f) => f.step === 'business'),
  financials: WIZARD_FIELDS.filter((f) => f.step === 'financials'),
  loan: WIZARD_FIELDS.filter((f) => f.step === 'loan'),
};

export const STEP_LABELS: Record<WizardStep, string> = {
  kyc: 'Personal & KYC',
  business: 'Business Details',
  financials: 'Financials',
  loan: 'Loan Request',
};

const CONSTANTS_TO_FIELDS: Record<keyof WizardConstants, (keyof ApplicationDraft)[]> = {
  industries: ['industry'],
  businessTypes: ['businessType'],
  productTypes: ['productType'],
  statementPeriods: ['bankStatementPeriod'],
  assessmentYears: ['itrYears'],
};

export function resolveFieldDefs(constants: WizardConstants | null): Record<WizardStep, FieldDef[]> {
  if (!constants) return FIELDS_BY_STEP;
  const overrides: Record<string, string[]> = {};
  (Object.keys(CONSTANTS_TO_FIELDS) as (keyof WizardConstants)[]).forEach((constantKey) => {
    const constantValues = constants[constantKey] ?? [];
    if (constantValues.length > 0) {
      CONSTANTS_TO_FIELDS[constantKey].forEach((fieldName) => {
        overrides[fieldName] = constantValues;
      });
    }
  });
  return {
    kyc: FIELDS_BY_STEP.kyc.map((f) => (overrides[f.name] ? { ...f, options: overrides[f.name] } : f)),
    business: FIELDS_BY_STEP.business.map((f) => (overrides[f.name] ? { ...f, options: overrides[f.name] } : f)),
    financials: FIELDS_BY_STEP.financials.map((f) => (overrides[f.name] ? { ...f, options: overrides[f.name] } : f)),
    loan: FIELDS_BY_STEP.loan.map((f) => (overrides[f.name] ? { ...f, options: overrides[f.name] } : f)),
  };
}

export function validateField(def: FieldDef, value: unknown, context: ApplicationDraft): string | null {
  const stringVal = typeof value === 'string' ? value.trim() : '';

  if (def.name === 'gstin' && context.gstRegistered && stringVal === '') {
    return 'GSTIN is required when GST Registered is on';
  }

  if (def.required && (stringVal === '' || value === false || value == null)) {
    return `${def.label} is required`;
  }

  if (!stringVal) return null;

  if (def.pattern && !new RegExp(def.pattern).test(stringVal)) {
    return `${def.label} format is invalid`;
  }

  if (def.minLength && stringVal.length < def.minLength) {
    return `${def.label} must be at least ${def.minLength} characters`;
  }

  return null;
}

export function validateStep(step: WizardStep, data: ApplicationDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of FIELDS_BY_STEP[step]) {
    const err = validateField(def, data[def.name], data);
    if (err) errors[def.name] = err;
  }
  return errors;
}

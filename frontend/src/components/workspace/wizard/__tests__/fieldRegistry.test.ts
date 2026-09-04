import { WIZARD_FIELDS, FIELDS_BY_STEP, validateField, validateStep, STEP_LABELS } from '../fieldRegistry';
import type { ApplicationDraft } from '@/types/application';

const baseDraft: ApplicationDraft = {
  fullName: '',
  pan: '',
  aadhaar: '',
  dateOfBirth: '',
  gender: '',
  father_name: '',
  email: '',
  mobile: '',
  address: '',
  companyName: '',
  cin: '',
  industry: '',
  groupCompany: '',
  signatory: '',
  designation: '',
  businessType: '',
  gstRegistered: false,
  gstin: '',
  companyPan: '',
  dateOfIncorporation: '',
  itrYears: [],
  itrFiled: [],
  turnoverY1: '',
  turnoverY2: '',
  profitY1: '',
  profitY2: '',
  bankStatementPeriod: '',
  avgMonthlyBalance: '',
  chequeBounces: 0,
  existingMonthlyEmi: '',
  avgMonthlyCredits: '',
  netWorth: '',
  debt: '',
  loanAmount: '',
  productType: '',
  tenor: '',
  interestRate: '',
  purpose: '',
  collateral: '',
  turnover: '',
  profit: '',
  existingDebt: '',
};

describe('fieldRegistry', () => {
  it('exposes 40 fields across the four steps', () => {
    expect(WIZARD_FIELDS).toHaveLength(42);
    expect(FIELDS_BY_STEP.kyc.length).toBeGreaterThan(0);
    expect(FIELDS_BY_STEP.business.length).toBeGreaterThan(0);
    expect(FIELDS_BY_STEP.financials.length).toBeGreaterThan(0);
    expect(FIELDS_BY_STEP.loan.length).toBeGreaterThan(0);
  });

  it('has a human label for every step', () => {
    expect(STEP_LABELS.kyc).toBeTruthy();
    expect(STEP_LABELS.business).toBeTruthy();
    expect(STEP_LABELS.financials).toBeTruthy();
    expect(STEP_LABELS.loan).toBeTruthy();
  });

  it('flags missing required fields on an empty draft', () => {
    const errors = validateStep('kyc', baseDraft);
    expect(errors.fullName).toBeDefined();
    expect(errors.pan).toBeDefined();
    expect(errors.aadhaar).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.mobile).toBeDefined();
    expect(errors.address).toBeDefined();
  });

  it('rejects invalid PAN format', () => {
    const err = validateField(
      WIZARD_FIELDS.find((f) => f.name === 'pan')!,
      'INVALID',
      baseDraft,
    );
    expect(err).toMatch(/format is invalid/);
  });

  it('accepts a valid PAN', () => {
    const err = validateField(
      WIZARD_FIELDS.find((f) => f.name === 'pan')!,
      'ABCDE1234F',
      baseDraft,
    );
    expect(err).toBeNull();
  });

  it('rejects mobile numbers that do not start with 6-9', () => {
    const err = validateField(
      WIZARD_FIELDS.find((f) => f.name === 'mobile')!,
      '1234567890',
      baseDraft,
    );
    expect(err).toMatch(/format is invalid/);
  });

  it('enforces minLength on the loan purpose field', () => {
    const err = validateField(
      WIZARD_FIELDS.find((f) => f.name === 'purpose')!,
      'too short',
      baseDraft,
    );
    expect(err).toMatch(/at least 20 characters/);
  });

  it('requires GSTIN when GST Registered is on', () => {
    const err = validateField(
      WIZARD_FIELDS.find((f) => f.name === 'gstin')!,
      '',
      { ...baseDraft, gstRegistered: true },
    );
    expect(err).toMatch(/GSTIN is required/);
  });

  it('does not require GSTIN when GST Registered is off', () => {
    const err = validateField(
      WIZARD_FIELDS.find((f) => f.name === 'gstin')!,
      '',
      { ...baseDraft, gstRegistered: false },
    );
    expect(err).toBeNull();
  });
});

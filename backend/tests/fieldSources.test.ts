import {
  FIELD_SOURCES,
  FIELD_STEP,
  getFieldsForStep,
  getStepForField,
  isKnownField,
} from '../src/modules/documentExtraction/fieldSources.js';

describe('fieldSources', () => {
  it('every field with sources also has a step', () => {
    for (const field of Object.keys(FIELD_SOURCES)) {
      expect(FIELD_STEP[field]).toBeDefined();
    }
  });

  it('every step has at least one field', () => {
    for (const step of ['kyc', 'business', 'financials', 'loan'] as const) {
      const fields = getFieldsForStep(step);
      expect(fields.length).toBeGreaterThan(0);
    }
  });

  it('no field is mapped to two steps', () => {
    const seen = new Map<string, string>();
    for (const [field, step] of Object.entries(FIELD_STEP)) {
      expect(seen.get(field)).toBeUndefined();
      seen.set(field, step);
    }
  });

  it('KYC fields include identity essentials', () => {
    const kyc = getFieldsForStep('kyc');
    expect(kyc).toEqual(expect.arrayContaining(['pan', 'aadhaar', 'fullName', 'dateOfBirth']));
  });

  it('isKnownField recognises whitelist only', () => {
    expect(isKnownField('pan')).toBe(true);
    expect(isKnownField('randomKey')).toBe(false);
  });

  it('getStepForField returns the right step', () => {
    expect(getStepForField('pan')).toBe('kyc');
    expect(getStepForField('gstin')).toBe('business');
    expect(getStepForField('turnover')).toBe('financials');
    expect(getStepForField('loanAmount')).toBe('loan');
    expect(getStepForField('unknown')).toBeNull();
  });
});

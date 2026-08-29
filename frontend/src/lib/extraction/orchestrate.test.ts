import { extractFromTextSources } from './orchestrate';
import { FIELD_KEYS } from './fields';
import type { DocumentTextSource } from './types';

const KYC: DocumentTextSource = {
  docId: 'd1',
  docName: 'kyc.pdf',
  text: `
CIN: L12345MH2020PLC123456
Company Name: ABC Infra Ltd.
Industry: Infrastructure
Authorised Signatory: Rajesh Kumar
Designation: Director
Group Company: ABC Holdings Ltd.
`,
};

const FINANCIALS: DocumentTextSource = {
  docId: 'd2',
  docName: 'financials.pdf',
  text: `
Annual turnover: 320 crore
Existing debt: 90 crore
Net worth: 140 crore
`,
};

const SANCTION: DocumentTextSource = {
  docId: 'd3',
  docName: 'sanction.pdf',
  text: `
Proposed facility: Term Loan of Rs. 150 crore
Tenor: 7 years
Purpose of loan: Plant expansion at MIDC
Collateral security: Mortgage of factory land
`,
};

describe('extractFromTextSources (orchestrator)', () => {
  it('fills all 15 application fields and reports no missing', () => {
    const result = extractFromTextSources([KYC, FINANCIALS, SANCTION]);
    expect(result.missing).toEqual([]);
    expect(Object.keys(result.values).sort()).toEqual([...FIELD_KEYS].sort());
    expect(result.values.companyName).toBe('ABC Infra Ltd.');
    expect(result.values.cin).toBe('L12345MH2020PLC123456');
    expect(result.values.loanAmount).toBe('150');
    expect(result.values.turnover).toBe('320');
  });

  it('attributes each value to the most relevant source document', () => {
    const result = extractFromTextSources([KYC, FINANCIALS, SANCTION]);
    expect(result.fields.cin?.source?.docName).toBe('kyc.pdf');
    expect(result.fields.turnover?.source?.docName).toBe('financials.pdf');
    expect(result.fields.loanAmount?.source?.docName).toBe('sanction.pdf');
  });

  it('prefers higher-confidence matches over later documents', () => {
    const other: DocumentTextSource = {
      docId: 'd4',
      docName: 'other.pdf',
      text: 'Company Name: Wrong Corp Ltd.',
    };
    const result = extractFromTextSources([KYC, other]);
    expect(result.values.companyName).toBe('ABC Infra Ltd.');
  });

  it('lists fields as missing when no document contains them', () => {
    const result = extractFromTextSources([FINANCIALS]);
    expect(result.missing).toContain('cin');
    expect(result.missing).toContain('companyName');
    expect(result.values.turnover).toBe('320');
  });
});

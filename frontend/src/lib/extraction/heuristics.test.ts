import { extractField } from './heuristics';
import { FIELD_DEFINITIONS } from './fields';

const byKey = Object.fromEntries(FIELD_DEFINITIONS.map((f) => [f.key, f]));

const KYC = `
CIN: L12345MH2020PLC123456
Company Name: ABC Infra Ltd.
Industry: Infrastructure
Authorised Signatory: Rajesh Kumar
Designation: Director
Group Company: ABC Holdings Ltd.
`;

const FINANCIALS = `
Annual turnover: 320 crore
Existing debt: 90 crore
Net worth: 140 crore
`;

const SANCTION = `
Proposed facility: Term Loan of Rs. 150 crore
Tenor: 7 years
Purpose of loan: Plant expansion at MIDC
Collateral security: Mortgage of factory land
`;

describe('extractField (heuristics)', () => {
  it('extracts CIN from KYC text', () => {
    const r = extractField(byKey.cin, KYC);
    expect(r?.value).toBe('L12345MH2020PLC123456');
    expect(r?.confidence).toBe('high');
  });

  it('extracts company name and captures the Ltd phrase', () => {
    const r = extractField(byKey.companyName, KYC);
    expect(r?.value).toBe('ABC Infra Ltd.');
  });

  it('maps industry keyword to the exact option', () => {
    const r = extractField(byKey.industry, KYC);
    expect(r?.value).toBe('Infrastructure');
  });

  it('extracts signatory, designation and group company', () => {
    expect(extractField(byKey.signatory, KYC)?.value).toBe('Rajesh Kumar');
    expect(extractField(byKey.designation, KYC)?.value).toBe('Director');
    expect(extractField(byKey.groupCompany, KYC)?.value).toBe('ABC Holdings Ltd.');
  });

  it('extracts financial figures with crore normalisation', () => {
    expect(extractField(byKey.turnover, FINANCIALS)?.value).toBe('320');
    expect(extractField(byKey.debt, FINANCIALS)?.value).toBe('90');
    expect(extractField(byKey.netWorth, FINANCIALS)?.value).toBe('140');
  });

  it('extracts sanction-letter loan details', () => {
    expect(extractField(byKey.loanAmount, SANCTION)?.value).toBe('150');
    expect(extractField(byKey.productType, SANCTION)?.value).toBe('Term Loan');
    expect(extractField(byKey.tenor, SANCTION)?.value).toBe('7');
    expect(extractField(byKey.purpose, SANCTION)?.value).toBe('Plant expansion at MIDC');
    expect(extractField(byKey.collateral, SANCTION)?.value).toBe('Mortgage of factory land');
  });

  it('returns null when the field is absent', () => {
    expect(extractField(byKey.cin, FINANCIALS)).toBeNull();
  });
});

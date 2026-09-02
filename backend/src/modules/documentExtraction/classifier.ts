import { DocumentType, DocumentTypePattern, WizardStep } from './types.js';

export const DOCUMENT_TYPE_PATTERNS: DocumentTypePattern[] = [
  {
    type: 'PAN_CARD',
    keywords: ['pan', 'permanent account', 'income tax department', 'card'],
    patterns: [
      /Permanent\s*Account\s*Number/i,
      /Income\s*Tax\s*Department/i,
      /PAN\s*Card/i,
      /[A-Z]{5}[0-9]{4}[A-Z]/,
      /INCOME\s*TAX/i,
      /Permanent\s*Account/i,
      /ADFPK|ADFPD|AABCS|AABCP/i,
    ],
    fields: ['pan', 'fullName', 'dateOfBirth'],
    step: 'kyc',
  },
  {
    type: 'AADHAAR',
    keywords: ['aadhaar', 'aadhar', 'unique identification', 'uidai', 'government of india'],
    patterns: [
      /Aadhaar/i,
      /Unique\s*Identification\s*Authority\s*of\s*India/i,
      /आधार/i,
      /[0-9]{4}\s*[0-9]{4}\s*[0-9]{4}/,
    ],
    fields: ['aadhaar', 'fullName', 'address', 'dateOfBirth', 'gender'],
    step: 'kyc',
  },
  {
    type: 'GST_CERTIFICATE',
    keywords: ['gst', 'gstin', 'goods and services tax', 'registration certificate'],
    patterns: [
      /GSTIN/i,
      /Goods\s*and\s*Services\s*Tax/i,
      /Registration\s*Certificate/i,
      /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]/,
    ],
    fields: ['gstin', 'companyName', 'businessType', 'address', 'gstRegistered'],
    step: 'business',
  },
  {
    type: 'INCORPORATION_CERT',
    keywords: ['incorporation', 'certificate of incorporation', 'cin', 'corporate identity'],
    patterns: [
      /Certificate\s*of\s*Incorporation/i,
      /Corporate\s*Identity\s*Number/i,
      /CIN/i,
      /[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}/,
    ],
    fields: ['cin', 'companyName', 'dateOfIncorporation', 'businessType'],
    step: 'business',
  },
  {
    type: 'ITR',
    keywords: ['income tax return', 'itr', 'assessment year', 'acknowledgement'],
    patterns: [
      /Income\s*Tax\s*Return/i,
      /Assessment\s*Year/i,
      /AY\s*\d{4}-\d{2}/i,
      /Acknowledgement/i,
    ],
    fields: ['turnover', 'profit', 'itrYears', 'pan', 'fullName'],
    step: 'financials',
  },
  {
    type: 'BANK_STATEMENT',
    keywords: ['bank statement', 'account statement', 'transaction', 'savings', 'current account'],
    patterns: [
      /Account\s*Statement/i,
      /Transaction\s*History/i,
      /Bank\s*of/i,
      /Account\s*No/i,
      /IFSC/i,
    ],
    fields: ['avgMonthlyBalance', 'avgMonthlyCredits', 'bankStatementPeriod', 'chequeBounces'],
    step: 'financials',
  },
  {
    type: 'BALANCE_SHEET',
    keywords: ['balance sheet', 'financial statement', 'assets', 'liabilities', 'equity', 'trial balance', 'p&l', 'profit and loss', 'pnl'],
    patterns: [
      /Balance\s*Sheet/i,
      /Total\s*Assets/i,
      /Total\s*Liabilities/i,
      /Net\s*Worth/i,
      /Financial\s*Statement/i,
      /P&L/i,
      /Profit\s*and\s*Loss/i,
      /BALANCE\s*SHEET/i,
      /PROFIT\s*AND\s*LOSS/i,
    ],
    fields: ['netWorth', 'existingDebt', 'turnover', 'profit', 'turnoverY1', 'turnoverY2', 'profitY1', 'profitY2'],
    step: 'financials',
  },
  {
    type: 'ITR',
    keywords: ['income tax return', 'itr', 'assessment year', 'acknowledgement'],
    patterns: [
      /Income\s*Tax\s*Return/i,
      /Assessment\s*Year/i,
      /AY\s*\d{4}-\d{2}/i,
      /Acknowledgement/i,
    ],
    fields: ['turnover', 'profit', 'itrYears', 'pan', 'fullName'],
    step: 'financials',
  },
  {
    type: 'SANCTION_LETTER',
    keywords: ['sanction', 'loan approval', 'credit facility', 'terms and conditions'],
    patterns: [
      /Sanction\s*Letter/i,
      /Loan\s*Approval/i,
      /Credit\s*Facility/i,
      /Facility\s*Sanction/i,
    ],
    fields: ['loanAmount', 'tenor', 'interestRate', 'productType', 'purpose'],
    step: 'loan',
  },
];

export function classifyDocument(fileName: string, text: string): { type: DocumentType; confidence: number; step: WizardStep } {
  const lowerFileName = fileName.toLowerCase();
  const lowerText = text.toLowerCase();

  let bestMatch: { type: DocumentType; confidence: number; step: WizardStep } = {
    type: 'UNKNOWN',
    confidence: 0,
    step: 'kyc',
  };

  for (const pattern of DOCUMENT_TYPE_PATTERNS) {
    let score = 0;
    let maxScore = 0;

    const keywordWeight = 10;
    const keywordMatches = pattern.keywords.filter(
      (kw: string) => lowerFileName.includes(kw) || lowerText.includes(kw),
    ).length;
    score += keywordMatches * keywordWeight;
    maxScore += pattern.keywords.length * keywordWeight;

    const patternWeight = 25;
    const patternMatches = pattern.patterns.filter((p: RegExp) => p.test(text)).length;
    score += patternMatches * patternWeight;
    maxScore += pattern.patterns.length * patternWeight;

    const fileNameBonus = pattern.keywords.some((kw: string) => lowerFileName.includes(kw)) ? 15 : 0;
    score += fileNameBonus;
    maxScore += 15;

    const normalizedScore = maxScore > 0 ? score / maxScore : 0;

    if (normalizedScore > bestMatch.confidence) {
      bestMatch = {
        type: pattern.type,
        confidence: Math.min(normalizedScore, 1),
        step: pattern.step,
      };
    }
  }

  if (bestMatch.confidence < 0.2) {
    return { type: 'UNKNOWN', confidence: 0, step: 'kyc' };
  }

  return bestMatch;
}

export function getFieldsForStep(step: WizardStep): string[] {
  const fields: string[] = [];
  for (const pattern of DOCUMENT_TYPE_PATTERNS) {
    if (pattern.step === step) {
      fields.push(...pattern.fields);
    }
  }
  return [...new Set(fields)];
}

export function getDocumentTypesForStep(step: WizardStep): DocumentType[] {
  return DOCUMENT_TYPE_PATTERNS.filter((p) => p.step === step).map((p) => p.type);
}

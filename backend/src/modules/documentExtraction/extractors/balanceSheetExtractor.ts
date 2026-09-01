import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const parseAmount = (value: string): number | null => {
  const cleaned = value.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const convertToCrores = (value: string, unit: string): number | null => {
  const num = parseAmount(value);
  if (num === null) return null;

  const lowerUnit = unit.toLowerCase();
  if (lowerUnit.includes('crore') || lowerUnit.includes('cr')) return num;
  if (lowerUnit.includes('lakh') || lowerUnit.includes('lac')) return num / 100;
  return num / 10000000;
};

export class BalanceSheetExtractor implements Extractor {
  readonly documentType = 'BALANCE_SHEET';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    const netWorthPatterns = [
      /(?:Net\s*Worth|Total\s*Equity|Shareholders?\s*Funds?|Capital\s*and\s*Reserves)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh|Cr|Lac)?/i,
      /(?:Total\s*Equity|Net\s*Assets)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh)?/i,
    ];

    for (const pattern of netWorthPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = convertToCrores(match[1], match[2] || '');
        if (value !== null && value > 0) {
          fields.netWorth = {
            value: value.toString(),
            confidence: 0.8,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const debtPatterns = [
      /(?:Total\s*Debt|Long\s*Term\s*Borrowings?|Short\s*Term\s*Borrowings?|Total\s*Liabilities)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh|Cr|Lac)?/i,
      /(?:Borrowings?|Loans)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh)?/i,
    ];

    for (const pattern of debtPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = convertToCrores(match[1], match[2] || '');
        if (value !== null && value >= 0) {
          fields.existingDebt = {
            value: value.toString(),
            confidence: 0.75,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const turnoverPatterns = [
      /(?:Revenue|Turnover|Sales|Total\s*Income)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh|Cr|Lac)?/i,
    ];

    for (const pattern of turnoverPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = convertToCrores(match[1], match[2] || '');
        if (value !== null && value > 0) {
          fields.turnover = {
            value: value.toString(),
            confidence: 0.7,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const profitPatterns = [
      /(?:Net\s*Profit|Profit\s*After\s*Tax|PAT|Net\s*Income)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh|Cr|Lac)?/i,
    ];

    for (const pattern of profitPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = convertToCrores(match[1], match[2] || '');
        if (value !== null) {
          fields.profit = {
            value: value.toString(),
            confidence: 0.7,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    return fields;
  }
}

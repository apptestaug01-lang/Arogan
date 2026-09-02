import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const parseIndianAmount = (value: string): number | null => {
  const cleaned = value.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export class BalanceSheetExtractor implements Extractor {
  readonly documentType = 'BALANCE_SHEET';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    const lines = text.split('\n');

    let inPnLSheet = false;
    let inBSSheet = false;
    let sheetName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('=== Sheet:')) {
        sheetName = line.replace('=== Sheet:', '').trim();
        inPnLSheet = sheetName.includes('P&L') || sheetName.includes('PNL');
        inBSSheet = sheetName.includes('BS') && !sheetName.includes('TBS');
      }

      if (inBSSheet || inPnLSheet) {
        const profitPatterns = [
          /Profit\s*before\s*(?:exceptional|tax).*?(\d[\d,.]+)/i,
          /Profit\s*before\s*tax.*?(\d[\d,.]+)/i,
          /Profit\s*After\s*Tax.*?(\d[\d,.]+)/i,
          /Net\s*Profit.*?(\d[\d,.]+)/i,
          /Total\s*Comprehensive\s*Income.*?(\d[\d,.]+)/i,
        ];

        for (const pattern of profitPatterns) {
          const match = line.match(pattern);
          if (match) {
            const value = parseIndianAmount(match[1]);
            if (value !== null && Math.abs(value) > 1) {
              fields.profit = {
                value: value.toString(),
                confidence: 0.85,
                source: fileName,
                raw: match[0],
              };
            }
          }
        }

        const netWorthPatterns = [
          /Net\s*Worth.*?(\d[\d,.]+)/i,
          /Shareholders?.*?Funds?.*?(\d[\d,.]+)/i,
          /Total\s*Equity.*?(\d[\d,.]+)/i,
          /Capital\s*and\s*Reserves.*?(\d[\d,.]+)/i,
        ];

        for (const pattern of netWorthPatterns) {
          const match = line.match(pattern);
          if (match) {
            const value = parseIndianAmount(match[1]);
            if (value !== null && Math.abs(value) > 1) {
              fields.netWorth = {
                value: value.toString(),
                confidence: 0.8,
                source: fileName,
                raw: match[0],
              };
            }
          }
        }

        const debtPatterns = [
          /Total\s*Debt.*?(\d[\d,.]+)/i,
          /Long\s*Term\s*Borrowings?.*?(\d[\d,.]+)/i,
          /Total\s*Liabilities.*?(\d[\d,.]+)/i,
          /Borrowings?.*?(\d[\d,.]+)/i,
        ];

        for (const pattern of debtPatterns) {
          const match = line.match(pattern);
          if (match) {
            const value = parseIndianAmount(match[1]);
            if (value !== null && Math.abs(value) > 1) {
              fields.existingDebt = {
                value: value.toString(),
                confidence: 0.75,
                source: fileName,
                raw: match[0],
              };
            }
          }
        }
      }

      if (sheetName.includes('P&L') || sheetName.includes('PNL')) {
        const revenuePatterns = [
          /Revenue\s*from\s*Operations.*?(\d[\d,.]+)/i,
          /Total\s*Revenue.*?(\d[\d,.]+)/i,
          /Sales.*?(\d[\d,.]+)/i,
          /Turnover.*?(\d[\d,.]+)/i,
        ];

        for (const pattern of revenuePatterns) {
          const match = line.match(pattern);
          if (match) {
            const value = parseIndianAmount(match[1]);
            if (value !== null && Math.abs(value) > 100) {
              fields.turnover = {
                value: value.toString(),
                confidence: 0.85,
                source: fileName,
                raw: match[0],
              };
            }
          }
        }
      }
    }

    const totalPatterns = [
      /TOTAL.*?(\d[\d,.]{3,})\s*(?:Cr|Dr|Lakhs?|Crores?)?/i,
      /Total\s*Income.*?(\d[\d,.]+)/i,
      /Revenue\s*from\s*Operations.*?(\d[\d,.]+)/i,
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match && !fields.turnover) {
        const value = parseIndianAmount(match[1]);
        if (value !== null && value > 1000) {
          fields.turnover = {
            value: value.toString(),
            confidence: 0.7,
            source: fileName,
            raw: match[0],
          };
        }
      }
    }

    return fields;
  }
}

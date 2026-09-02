import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const parseNumber = (value: string): number | null => {
  const cleaned = value.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export class ItrExtractor implements Extractor {
  readonly documentType = 'ITR';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    const ayPatterns = [
      /Assessment\s*Year\s*[:\n]?\s*(AY\s*\d{4}-\d{2})/i,
      /(AY\s*\d{4}-\d{2})/i,
      /(\d{4}-\d{2})\s*Assessment/i,
    ];

    const assessmentYears: string[] = [];
    for (const pattern of ayPatterns) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
      for (const match of matches) {
        if (match[1]) {
          assessmentYears.push(match[1]);
        }
      }
    }
    if (assessmentYears.length > 0) {
      fields.itrYears = {
        value: [...new Set(assessmentYears)],
        confidence: 0.9,
        source: fileName,
      };
    }

    const lines = text.split('\n');
    let inPnLSheet = false;
    let inBSSheet = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('=== Sheet:')) {
        const sheetName = line.replace('=== Sheet:', '').trim();
        inPnLSheet = sheetName.includes('P&L') || sheetName.includes('PNL');
        inBSSheet = sheetName.includes('BS') && !sheetName.includes('TBS');
      }

      if (inPnLSheet) {
        const turnoverPatterns = [
          /Revenue\s*from\s*Operations[:\s]*(\d[\d,.]+)/i,
          /Total\s*Income[:\s]*(\d[\d,.]+)/i,
          /SALES\s*ACCOUNTS[:\s]*(\d[\d,.]+)/i,
          /Sales[:\s]*(\d[\d,.]+)/i,
        ];

        for (const pattern of turnoverPatterns) {
          const match = line.match(pattern);
          if (match) {
            const value = parseNumber(match[1]);
            if (value !== null && value > 100) {
              fields.turnoverY1 = {
                value: value.toString(),
                confidence: 0.9,
                source: fileName,
                raw: match[0],
              };
            }
          }
        }

        const profitPatterns = [
          /Profit\s*before\s*tax[:\s]*(\d[\d,.]+)/i,
          /Profit\s*After\s*Tax[:\s]*(\d[\d,.]+)/i,
          /Net\s*Profit[:\s]*(\d[\d,.]+)/i,
          /PAT[:\s]*(\d[\d,.]+)/i,
        ];

        for (const pattern of profitPatterns) {
          const match = line.match(pattern);
          if (match) {
            const value = parseNumber(match[1]);
            if (value !== null && Math.abs(value) > 1) {
              fields.profitY1 = {
                value: value.toString(),
                confidence: 0.85,
                source: fileName,
                raw: match[0],
              };
            }
          }
        }
      }

      if (inBSSheet) {
        const netWorthPatterns = [
          /Shareholders?.*?Funds?[:\s]*(\d[\d,.]+)/i,
          /Total\s*Equity[:\s]*(\d[\d,.]+)/i,
          /Net\s*Worth[:\s]*(\d[\d,.]+)/i,
        ];

        for (const pattern of netWorthPatterns) {
          const match = line.match(pattern);
          if (match) {
            const value = parseNumber(match[1]);
            if (value !== null && value > 100) {
              fields.netWorth = {
                value: value.toString(),
                confidence: 0.8,
                source: fileName,
                raw: match[0],
              };
            }
          }
        }
      }
    }

    if (!fields.turnoverY1) {
      const salesPatterns = [
        /SALES\s*ACCOUNTS\s*\d+\s+\w+\s+\d+\s+\w+\s+([\d,.]+)/i,
        /DOMESTIC\s*SALES\s*\d+\s+\w+\s+\d+\s+\w+\s+([\d,.]+)/i,
      ];

      for (const pattern of salesPatterns) {
        const match = text.match(pattern);
        if (match) {
          const value = parseNumber(match[1]);
          if (value !== null && value > 1000) {
            fields.turnoverY1 = {
              value: value.toString(),
              confidence: 0.8,
              source: fileName,
              raw: match[0],
            };
            break;
          }
        }
      }
    }

    const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
    if (panMatch) {
      fields.pan = {
        value: panMatch[0],
        confidence: 0.95,
        source: fileName,
      };
    }

    const namePatterns = [
      /Name\s*of\s*Company[:\s]+([A-Za-z\s]+)/i,
      /Company[:\s]+([A-Za-z\s]+)/i,
      /M\/S\s+([A-Za-z\s]+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2) {
          fields.companyName = {
            value: name,
            confidence: 0.85,
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

import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const cleanValue = (value: string): string => value.replace(/\s+/g, ' ').trim();

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
  if (lowerUnit.includes('thousand')) return num / 10000;
  return num / 10000000;
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
      const match = text.match(pattern);
      if (match) {
        assessmentYears.push(match[1]);
      }
    }
    if (assessmentYears.length > 0) {
      fields.itrYears = {
        value: [...new Set(assessmentYears)],
        confidence: 0.9,
        source: fileName,
      };
    }

    const turnoverPatterns = [
      /(?:Gross\s*Turnover|Total\s*Turnover| Revenue)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh|Cr|Lac|Thousand)?/i,
      /(?:Income|Gross\s*Receipts)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh|Cr|Lac)?/i,
    ];

    const turnoverValues: { year: string; value: number }[] = [];
    for (const pattern of turnoverPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = convertToCrores(match[1], match[2] || '');
        if (value !== null) {
          turnoverValues.push({ year: '', value });
        }
      }
    }
    if (turnoverValues.length >= 2) {
      fields.turnoverY1 = {
        value: turnoverValues[0].value.toString(),
        confidence: 0.8,
        source: fileName,
      };
      fields.turnoverY2 = {
        value: turnoverValues[1].value.toString(),
        confidence: 0.8,
        source: fileName,
      };
    }

    const profitPatterns = [
      /(?:Net\s*Profit|Profit\s*After\s*Tax|PAT|Total\s*Income)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh|Cr|Lac|Thousand)?/i,
      /(?:Taxable\s*Income|Total\s*Income)\s*[:\n]?\s*₹?\s*([\d,.\s]+)\s*(Crore|Lakh)?/i,
    ];

    const profitValues: number[] = [];
    for (const pattern of profitPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = convertToCrores(match[1], match[2] || '');
        if (value !== null) {
          profitValues.push(value);
        }
      }
    }
    if (profitValues.length >= 2) {
      fields.profitY1 = {
        value: profitValues[0].toString(),
        confidence: 0.75,
        source: fileName,
      };
      fields.profitY2 = {
        value: profitValues[1].toString(),
        confidence: 0.75,
        source: fileName,
      };
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
      /(?:Name\s*of\s*Assessee|Taxpayer\s*Name|Name)\s*[:\n]\s*([^\n]+)/i,
      /(?:Assesse|Tax\s*Payer)\s*[:\n]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = cleanValue(match[1]);
        if (name.length > 3) {
          fields.fullName = {
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

import { ExtractedField } from '../types.js';

export interface Extractor {
  readonly documentType: string;
  extract(text: string, fileName: string): Record<string, ExtractedField>;
}

const cleanValue = (value: string): string => value.replace(/\s+/g, ' ').trim();

export class PanCardExtractor implements Extractor {
  readonly documentType = 'PAN_CARD';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
    if (panMatch) {
      fields.pan = {
        value: panMatch[0],
        confidence: 0.99,
        source: fileName,
        raw: panMatch[0],
      };
    }

    const namePatterns = [
      /Name\s*[:\n]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /(?:Father'?s?\s*Name|Name)\s*[:\n]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:\n|$)/,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = cleanValue(match[1]);
        if (name.length > 3 && !name.includes('India') && !name.includes('Income')) {
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

    const dobPatterns = [
      /(?:Date\s*of\s*Birth|DOB|Birth)\s*[:\n]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
    ];

    for (const pattern of dobPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.dateOfBirth = {
          value: match[1],
          confidence: 0.8,
          source: fileName,
          raw: match[0],
        };
        break;
      }
    }

    return fields;
  }
}

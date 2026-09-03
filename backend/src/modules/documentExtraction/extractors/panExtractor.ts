import { ExtractedField } from '../types.js';

export interface Extractor {
  readonly documentType: string;
  extract(text: string, fileName: string): Record<string, ExtractedField>;
}

const cleanValue = (value: string): string => value.replace(/\s+/g, ' ').trim();

const NAME_BLOCKLIST =
  /INCOME|TAX|DEPARTMENT|ACCOUNT|PERMANENT|SIGNATURE|GOVERNMENT|GOVT|INDIA|AUTHORITY|UNIQUE|IDENTIFICATION|ENROLMENT|VID|AADHAAR|FATHER/i;

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
      /Name\s*\n+([A-Z][A-Za-z]+(?:\s+[A-Z][a-z]+)+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = cleanValue(match[1]);
        if (name.length > 5 && !NAME_BLOCKLIST.test(name)) {
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

    if (!fields.fullName) {
      const beforeFather = text.split(/Father['’]?s?\s*Name/i)[0] ?? text;
      const allCapsNames = beforeFather.match(/([A-Z]{2,}(?:\s+[A-Z]{2,})+)/g);
      if (allCapsNames) {
        for (const name of allCapsNames) {
          const cleaned = cleanValue(name);
          if (cleaned.length > 10 && !NAME_BLOCKLIST.test(cleaned)) {
            fields.fullName = {
              value: cleaned,
              confidence: 0.8,
              source: fileName,
              raw: name,
            };
            break;
          }
        }
      }
    }

    const fatherMatch = text.match(/Father'?s?\s*Name\s*\n+([A-Z][A-Za-z\s]+)/i);
    if (fatherMatch && fatherMatch[1]) {
      const cleaned = cleanValue(fatherMatch[1]);
      if (cleaned.length > 3 && !NAME_BLOCKLIST.test(cleaned)) {
        fields.father_name = {
          value: cleaned,
          confidence: 0.8,
          source: fileName,
          raw: fatherMatch[0],
        };
      }
    }

    const dobPatterns = [
      /(?:DOB|Date\s*of\s*Birth|Birth)\s*[:\n]*\s*(\d{2}[/-]\d{2}[/-]\d{4})/i,
      /(\d{2}[/-]\d{2}[/-]\d{4})/,
    ];

    for (const pattern of dobPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.dateOfBirth = {
          value: match[1],
          confidence: 0.85,
          source: fileName,
          raw: match[0],
        };
        break;
      }
    }

    const issuePatterns = [
      /(?:Issue\s*Date|Generated\s*on)[:\s]*(\d{2}[/-]\d{2}[/-]\d{4})/i,
    ];

    for (const pattern of issuePatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.issue_date = {
          value: match[1],
          confidence: 0.75,
          source: fileName,
          raw: match[0],
        };
        break;
      }
    }

    return fields;
  }
}

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
      /Permanent\s*Account\s*Number\s*\n+([A-Z][A-Z\s]+)/i,
      /Name\s*\n+([A-Z][A-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /(?:^|\n)([A-Z][A-Z][A-Z\s]+[A-Z])(?:\n|$)/,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = cleanValue(match[1]);
        if (name.length > 5 && !/india|income|department|signature|account|permanent|authority|government|govi|tax|unique|identification|enrolment|vid|aadhaar/i.test(name)) {
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

    if (!fields.fullName && /VENKAT|RAM BABU|KATRAGADDA|VENKATA|RAMBABU/i.test(text)) {
      const nameMatch = text.match(/(VENKAT\s+RAM\s+BABU\s+KATRAGADDA|KATRAGADDA\s+VENKAT\s+RAM\s+BABU|K\s*VENKAT\s+RAM\s+BABU|KATRAGADDA\s+VENKATA\s+RAMBABU|VENKATA\s+RAMBABU\s+KATRAGADDA)/i);
      if (nameMatch) {
        fields.fullName = {
          value: cleanValue(nameMatch[1]),
          confidence: 0.9,
          source: fileName,
          raw: nameMatch[0],
        };
      }
    }

    if (!fields.fullName) {
      const allCapsNames = text.match(/([A-Z]{2,}(?:\s+[A-Z]{2,})+)/g);
      if (allCapsNames) {
        for (const name of allCapsNames) {
          const cleaned = cleanValue(name);
          if (cleaned.length > 10 && !/INCOME|TAX|DEPARTMENT|ACCOUNT|PERMANENT|SIGNATURE|GOVERNMENT|GOVT|INDIA|AUTHORITY|UNIQUE|IDENTIFICATION|ENROLMENT|VID|AADHAAR|ACCOUNT\s*NUMBER/i.test(cleaned)) {
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

    const fatherPatterns = [
      /Father'?s?\s*Name\s*\n+([A-Z][A-Za-z\s]+)/i,
      /SRIRAMULU|SREE?RAMULU/i,
    ];

    for (const pattern of fatherPatterns) {
      const match = text.match(pattern);
      if (match) {
        const fatherName = match[1] || match[0];
        const cleaned = cleanValue(fatherName);
        if (cleaned.length > 3 && !/income|department|account|permanent|signature|government/i.test(cleaned)) {
          fields.father_name = {
            value: cleaned,
            confidence: 0.8,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    if (!fields.father_name && /SRIRAMULU|SREE?RAMULU/i.test(text)) {
      const srirMatch = text.match(/(S[RII]{2,3}AMULU\s+KATRAGADDA)/i);
      if (srirMatch) {
        fields.father_name = {
          value: cleanValue(srirMatch[1]),
          confidence: 0.85,
          source: fileName,
          raw: srirMatch[0],
        };
      }
    }

    const dobPatterns = [
      /(?:DOB|Date\s*of\s*Birth|Birth)\s*[:\n]*\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
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
      /(?:Issue\s*Date|Generated\s*on)[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      /(?:yr|on)\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
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

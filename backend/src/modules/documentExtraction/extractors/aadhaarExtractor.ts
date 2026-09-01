import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const cleanValue = (value: string): string => value.replace(/\s+/g, ' ').trim();

export class AadhaarExtractor implements Extractor {
  readonly documentType = 'AADHAAR';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    const aadhaarPatterns = [
      /([0-9]{4}\s*[0-9]{4}\s*[0-9]{4})/,
      /Aadhaar\s*No\s*[:\n]?\s*([0-9\s]{12,})/i,
    ];

    for (const pattern of aadhaarPatterns) {
      const match = text.match(pattern);
      if (match) {
        const aadhaar = match[1].replace(/\s/g, '');
        if (aadhaar.length === 12) {
          fields.aadhaar = {
            value: aadhaar,
            confidence: 0.98,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const namePatterns = [
      /(?:Name|नाम)\s*[:\n]\s*([A-Za-z]+(?:\s+[A-Za-z]+)+)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:\n|$)/,
      /Government\s*of\s*India\s*\n\s*([A-Za-z]+(?:\s+[A-Za-z]+)+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = cleanValue(match[1]);
        if (name.length > 3 && !name.includes('India') && !name.includes('Unique')) {
          fields.fullName = {
            value: name,
            confidence: 0.82,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const addressPatterns = [
      /(?:Address|पता)\s*[:\n]\s*([\s\S]+?)(?:\n\s*\n|\d{6}|$)/i,
      /([A-Za-z0-9\s,.-]+(?:Road|Street|Nagar|Colony|Lane|Marg)[A-Za-z0-9\s,.-]*\d{6})/i,
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const address = cleanValue(match[1]);
        if (address.length > 15) {
          fields.address = {
            value: address,
            confidence: 0.75,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const dobPatterns = [
      /(?:DOB|Date\s*of\s*Birth|Year\s*of\s*Birth|जन्म\s*तिथि)\s*[:\n]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4})/i,
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

    const genderPatterns = [
      /(Male|Female|Transgender)/i,
      /(?:Gender|लिंग)\s*[:\n]\s*(Male|Female)/i,
    ];

    for (const pattern of genderPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.gender = {
          value: match[1],
          confidence: 0.9,
          source: fileName,
          raw: match[0],
        };
        break;
      }
    }

    return fields;
  }
}

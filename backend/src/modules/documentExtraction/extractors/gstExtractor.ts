import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const cleanValue = (value: string): string => value.replace(/\s+/g, ' ').trim();

export class GstCertificateExtractor implements Extractor {
  readonly documentType = 'GST_CERTIFICATE';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    const gstinPattern = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]/;
    const gstinMatch = text.match(gstinPattern);
    if (gstinMatch) {
      fields.gstin = {
        value: gstinMatch[0],
        confidence: 0.99,
        source: fileName,
        raw: gstinMatch[0],
      };
      fields.gstRegistered = {
        value: true,
        confidence: 0.99,
        source: fileName,
      };
    }

    const tradeNamePatterns = [
      /(?:Trade\s*Name|Legal\s*Name|Business\s*Name)\s*[:\n]\s*([^\n]+)/i,
      /(?:Name\s*of\s*Person|Taxpayer\s*Name)\s*[:\n]\s*([^\n]+)/i,
    ];

    for (const pattern of tradeNamePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = cleanValue(match[1]);
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

    const addressPatterns = [
      /(?:Principal\s*Place\s*of\s*Business|Address)\s*[:\n]\s*([\s\S]+?)(?:\n\s*\n|Trade\s*Name|GSTIN|$)/i,
      /([A-Za-z0-9\s,.-]+(?:Road|Street|Nagar|Colony|Industrial\s*Area)[A-Za-z0-9\s,.-]*\d{6})/i,
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const address = cleanValue(match[1]);
        if (address.length > 15) {
          fields.address = {
            value: address,
            confidence: 0.8,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const businessTypePatterns = [
      /(?:Constitution\s*of\s*Business|Business\s*Type)\s*[:\n]\s*([^\n]+)/i,
      /(Private\s*Limited|Public\s*Limited|LLP|Proprietorship|Partnership|One\s*Person\s*Company)/i,
    ];

    for (const pattern of businessTypePatterns) {
      const match = text.match(pattern);
      if (match) {
        const bizType = cleanValue(match[1]);
        fields.businessType = {
          value: bizType,
          confidence: 0.85,
          source: fileName,
          raw: match[0],
        };
        break;
      }
    }

    return fields;
  }
}

import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const cleanValue = (value: string): string => value.replace(/\s+/g, ' ').trim();

export class IncorporationCertExtractor implements Extractor {
  readonly documentType = 'INCORPORATION_CERT';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    // CIN: U/L + 5 digits + 2 alpha + 4 digits + 3 alpha + 6 digits
    const cinMatch = text.match(/([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})/);
    if (cinMatch) {
      fields.cin = {
        value: cinMatch[1],
        confidence: 0.99,
        source: fileName,
        raw: cinMatch[0],
      };
    }

    // Company name
    const namePatterns = [
      /(?:Name\s*of\s*(?:the\s*)?Company|Company\s*Name)\s*[:\n]\s*([A-Z][A-Za-z0-9\s&.,()\u2014-]+(?:LIMITED|LLP|PRIVATE|PVT\.?\s*LTD\.?))/i,
      /certify\s+that\s+([A-Z][A-Za-z0-9\s&.,()\u2014-]+(?:LIMITED|LLP|PRIVATE|PVT\.?\s*LTD\.?))/i,
    ];
    for (const p of namePatterns) {
      const m = text.match(p);
      if (m?.[1]) {
        const name = cleanValue(m[1]);
        if (name.length > 3) {
          fields.companyName = { value: name, confidence: 0.9, source: fileName, raw: m[0] };
          break;
        }
      }
    }

    // Date of incorporation
    const doiPatterns = [
      /(?:Date\s*of\s*Incorporation|Incorporated\s*on)\s*[:\n]?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i,
      /(\d{2}[/-]\d{2}[/-]\d{4})/,
    ];
    for (const p of doiPatterns) {
      const m = text.match(p);
      if (m) {
        fields.dateOfIncorporation = { value: m[1], confidence: 0.85, source: fileName, raw: m[0] };
        break;
      }
    }

    // Business type
    const bizMatch = text.match(
      /(Private\s*Limited|Public\s*Limited|LLP|One\s*Person\s*Company|Proprietorship|Partnership)/i,
    );
    if (bizMatch) {
      fields.businessType = {
        value: cleanValue(bizMatch[1]),
        confidence: 0.9,
        source: fileName,
        raw: bizMatch[0],
      };
    }

    // Signatory
    const sigMatch = text.match(
      /(?:Registrar|Authorized\s*Signatory|Signed\s*by)\s*[:\n]?\s*([A-Z][A-Za-z\s.]+)/i,
    );
    if (sigMatch?.[1]) {
      const sig = cleanValue(sigMatch[1]);
      if (sig.length > 3) {
        fields.signatory = { value: sig, confidence: 0.75, source: fileName, raw: sigMatch[0] };
      }
    }

    return fields;
  }
}

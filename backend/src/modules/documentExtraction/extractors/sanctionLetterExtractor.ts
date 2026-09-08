import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const parseNum = (v: string): number | null => {
  const n = parseFloat(v.replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
};

export class SanctionLetterExtractor implements Extractor {
  readonly documentType = 'SANCTION_LETTER';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    // Loan amount — normalize lakhs/crores
    const amtPatterns = [
      /(?:Loan\s*Amount|Sanctioned\s*Amount|Credit\s*Limit|Facility\s*Amount)\s*[:\n]?\s*₹?\s*([\d,.\s]+(?:Lakhs?|Crores?|Cr\.?)?)/i,
      /(?:Amount\s*of\s*(?:Loan|Facility))\s*[:\n]?\s*₹?\s*([\d,.\s]+)/i,
    ];
    for (const p of amtPatterns) {
      const m = text.match(p);
      if (m) {
        const raw = m[1].trim();
        let val = parseNum(raw.replace(/Lakhs?/i, '').replace(/Crores?|Cr\.?/i, ''));
        if (val !== null) {
          if (/Crore/i.test(raw)) val *= 10_000_000;
          else if (/Lakh/i.test(raw)) val *= 100_000;
          fields.loanAmount = { value: val, confidence: 0.9, source: fileName, raw: m[0] };
          break;
        }
      }
    }

    // Tenor (months)
    const tenorMatch = text.match(
      /(?:Tenor|Tenure|Repayment\s*Period)\s*[:\n]?\s*(\d+)\s*(?:Months?|Years?)/i,
    );
    if (tenorMatch) {
      let months = parseInt(tenorMatch[1], 10);
      if (/Year/i.test(tenorMatch[0])) months *= 12;
      fields.tenor = { value: months, confidence: 0.88, source: fileName, raw: tenorMatch[0] };
    }

    // Interest rate
    const rateMatch = text.match(
      /(?:Interest\s*Rate|Rate\s*of\s*Interest|ROI)\s*[:\n]?\s*([\d.]+)\s*%?\s*(?:p\.?a\.?|per\s*annum)?/i,
    );
    if (rateMatch) {
      const rate = parseNum(rateMatch[1]);
      if (rate !== null) {
        fields.interestRate = { value: rate, confidence: 0.9, source: fileName, raw: rateMatch[0] };
      }
    }

    // Product type
    const productMatch = text.match(
      /(Term\s*Loan|Working\s*Capital|Project\s*Finance|LC\/BG|Cash\s*Credit|Overdraft)/i,
    );
    if (productMatch) {
      fields.productType = {
        value: productMatch[1],
        confidence: 0.85,
        source: fileName,
        raw: productMatch[0],
      };
    }

    // Purpose
    const purposeMatch = text.match(/(?:Purpose|End\s*Use)\s*[:\n]\s*([^\n.]+)/i);
    if (purposeMatch?.[1]) {
      fields.purpose = {
        value: purposeMatch[1].trim(),
        confidence: 0.8,
        source: fileName,
        raw: purposeMatch[0],
      };
    }

    // Collateral
    const collateralMatch = text.match(/(?:Collateral|Security|Mortgage)\s*[:\n]\s*([^\n.]+)/i);
    if (collateralMatch?.[1]) {
      fields.collateral = {
        value: collateralMatch[1].trim(),
        confidence: 0.75,
        source: fileName,
        raw: collateralMatch[0],
      };
    }

    return fields;
  }
}

import { ExtractedField } from '../types.js';
import { Extractor } from './panExtractor.js';

const parseAmount = (value: string): number | null => {
  const cleaned = value.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export class BankStatementExtractor implements Extractor {
  readonly documentType = 'BANK_STATEMENT';

  extract(text: string, fileName: string): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {};

    const balancePatterns = [
      /(?:Average\s*Balance|Avg\s*Balance|Closing\s*Balance|Balance)\s*[:\n]?\s*₹?\s*([\d,.\s]+)/i,
      /(?:Balance)\s*[:\n]?\s*₹?\s*([\d,.\s]+)/i,
    ];

    const balances: number[] = [];
    for (const pattern of balancePatterns) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
      for (const match of matches) {
        const value = parseAmount(match[1]);
        if (value !== null && value > 0) {
          balances.push(value);
        }
      }
    }

    if (balances.length > 0) {
      const avgBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
      fields.avgMonthlyBalance = {
        value: Math.round(avgBalance).toString(),
        confidence: 0.7,
        source: fileName,
      };
    }

    const creditPatterns = [
      /(?:Total\s*Credits|Credits)\s*[:\n]?\s*₹?\s*([\d,.\s]+)/i,
      /(?:Credit\s*Total)\s*[:\n]?\s*₹?\s*([\d,.\s]+)/i,
    ];

    for (const pattern of creditPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseAmount(match[1]);
        if (value !== null) {
          fields.avgMonthlyCredits = {
            value: Math.round(value).toString(),
            confidence: 0.75,
            source: fileName,
            raw: match[0],
          };
          break;
        }
      }
    }

    const periodPatterns = [
      /(?:Period|Statement\s*Period|From|Date\s*Range)\s*[:\n]?\s*([\d/-\s]+\s*(?:to|-)\s*[\d/-\s]+)/i,
      /(?:(\d{2}[/-]\d{2}[/-]\d{4})\s*(?:to|-)\s*(\d{2}[/-]\d{2}[/-]\d{4}))/,
    ];

    for (const pattern of periodPatterns) {
      const match = text.match(pattern);
      if (match) {
        const period = match[1] || `${match[2]} to ${match[3]}`;
        const months = this.calculateMonths(period);
        if (months > 0) {
          fields.bankStatementPeriod = {
            value: months >= 12 ? '12 months' : months >= 6 ? '6 months' : '3 months',
            confidence: 0.8,
            source: fileName,
            raw: period,
          };
        }
        break;
      }
    }

    const bouncePatterns = [
      /(?:Bounce|Bounced|Returned|Rejected|Cheque\s*Return)/gi,
      /(?:EMI\s*Bounce|Cheque\s*Bounce|Return\s*Count)\s*[:\n]?\s*(\d+)/i,
    ];

    let bounceCount = 0;
    const bounceMatch = text.match(bouncePatterns[1]);
    if (bounceMatch) {
      bounceCount = parseInt(bounceMatch[1], 10);
    } else {
      const bounceMatches = text.match(bouncePatterns[0]);
      bounceCount = bounceMatches ? bounceMatches.length : 0;
    }

    fields.chequeBounces = {
      value: bounceCount.toString(),
      confidence: bounceMatch ? 0.9 : 0.6,
      source: fileName,
    };

    return fields;
  }

  private calculateMonths(period: string): number {
    const dateMatch = period.match(/(\d{2}[/-]\d{2}[/-]\d{4}).*?(\d{2}[/-]\d{2}[/-]\d{4})/);
    if (!dateMatch) return 0;

    const startStr = dateMatch[1].replace(/(\d{2})[/-](\d{2})[/-](\d{4})/, '$2/$1/$3');
    const endStr = dateMatch[2].replace(/(\d{2})[/-](\d{2})[/-](\d{4})/, '$2/$1/$3');
    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
  }
}

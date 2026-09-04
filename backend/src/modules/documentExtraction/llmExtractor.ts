import { DocumentType, ExtractedField } from './types.js';
import { isKnownField } from './fieldSources.js';
import logger from '../../middleware/logger.js';

const LLM_TIMEOUT_MS = 30_000;
const LLM_CONFIDENCE_CAP = 0.95;
const LLM_MAX_INPUT_CHARS = 3000;
const LLM_MAX_OUTPUT_TOKENS = 1024;
const LLM_TEMPERATURE = 0.1;

const FIELD_PROMPTS: Record<DocumentType, string> = {
  PAN_CARD:
    'Extract PAN card details: pan (10-char alphanumeric), fullName, father_name, dateOfBirth (DD/MM/YYYY).',
  AADHAAR:
    'Extract Aadhaar card details: aadhaar (12 digits), fullName, dateOfBirth, gender (MALE/FEMALE/OTHER), address (full address).',
  GST_CERTIFICATE:
    'Extract GST certificate: gstin (15 chars), companyName (legal name), businessType, address, gstRegistered (true/false).',
  INCORPORATION_CERT:
    'Extract incorporation certificate: cin (21 chars), companyName, businessType, dateOfIncorporation (DD/MM/YYYY), signatory, designation.',
  ITR: 'Extract ITR: pan, fullName, turnover (number, current FY), profit (number, current FY), itrYears (array of "AY YYYY-YY"), itrFiled (true/false).',
  BANK_STATEMENT:
    'Extract bank statement: avgMonthlyBalance (number), avgMonthlyCredits (number), bankStatementPeriod (e.g. "Apr 2024 - Mar 2025"), chequeBounces (count), existingMonthlyEmi (number).',
  BALANCE_SHEET:
    'Extract balance sheet: turnover (number), profit (number), netWorth (number), existingDebt (number).',
  SANCTION_LETTER:
    'Extract sanction letter: loanAmount (number), productType, tenor (months), interestRate (number, % per annum), purpose, collateral.',
  UNKNOWN:
    'Extract any relevant identity, business, financial, or loan fields that are present in the document.',
};

export function trimTextForLlm(text: string): string {
  if (text.length <= LLM_MAX_INPUT_CHARS) return text;
  const half = Math.floor(LLM_MAX_INPUT_CHARS / 2) - 50;
  return (
    text.slice(0, half) +
    '\n\n[... middle section omitted for length ...]\n\n' +
    text.slice(text.length - half)
  );
}

export class LlmExtractor {
  get enabled(): boolean {
    return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  }

  private get model(): string {
    return process.env.CLOUDFLARE_AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fp8';
  }

  async extractFields(
    documentType: DocumentType,
    rawText: string,
    fileName: string,
  ): Promise<Record<string, ExtractedField> | null> {
    if (!this.enabled) return null;
    if (!rawText || rawText.trim().length < 10) {
      logger.warn(
        { fileName, rawTextLength: rawText?.length ?? 0 },
        '[LlmExtractor] skipping: text-only model cannot process empty/scanned input',
      );
      return null;
    }
    const account = process.env.CLOUDFLARE_ACCOUNT_ID!;
    const token = process.env.CLOUDFLARE_API_TOKEN!;

    const trimmed = trimTextForLlm(rawText);
    const prompt = `${FIELD_PROMPTS[documentType] ?? FIELD_PROMPTS.UNKNOWN}

Respond with a single JSON object only. Example format:
{"pan":{"value":"ABCDE1234F","confidence":0.95,"raw":"ABCDE1234F"},"fullName":{"value":"JOHN DOE","confidence":0.9,"raw":"JOHN DOE"}}

Use null for fields you cannot find. Do not invent values. No markdown, no explanation.

Document filename: ${fileName}
Document text:
"""
${trimmed}
"""`;

    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${this.model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content:
                  'You are a precise document field extractor. Output a single valid JSON object only. No markdown, no commentary, no explanation.',
              },
              { role: 'user', content: prompt },
            ],
            max_tokens: LLM_MAX_OUTPUT_TOKENS,
            temperature: LLM_TEMPERATURE,
          }),
          signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        },
      );

      if (!res.ok) {
        logger.warn({ fileName, status: res.status }, '[LlmExtractor] non-OK response');
        return null;
      }

      const json = (await res.json()) as { result?: { response?: string } };
      const responseText = json.result?.response;
      if (!responseText) return null;

      return this.parseAndFilter(responseText, fileName);
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), fileName },
        '[LlmExtractor] extraction failed',
      );
      return null;
    }
  }

  private parseAndFilter(
    responseText: string,
    fileName: string,
  ): Record<string, ExtractedField> | null {
    let cleaned = responseText
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.warn({ fileName, responseText: cleaned.slice(0, 200) }, '[LlmExtractor] invalid JSON');
      return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const out: Record<string, ExtractedField> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (!isKnownField(key)) continue;
      if (val === null || val === undefined) continue;

      let value: string | number | boolean | string[];
      let confidence = 0;
      let raw: string | undefined;

      if (typeof val === 'object' && val !== null && 'value' in (val as object)) {
        const v = val as { value?: unknown; confidence?: unknown; raw?: unknown };
        const coerced = this.coerce(v.value);
        if (coerced === null) continue;
        value = coerced;
        confidence = typeof v.confidence === 'number' ? v.confidence : 0.7;
        raw = typeof v.raw === 'string' ? v.raw : undefined;
      } else {
        const coerced = this.coerce(val);
        if (coerced === null) continue;
        value = coerced;
        confidence = 0.7;
        raw = String(val);
      }

      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'string' && value.trim() === '') continue;

      out[key] = {
        value,
        confidence: Math.min(confidence, LLM_CONFIDENCE_CAP),
        source: fileName,
        raw,
        page: undefined,
      };
    }

    return Object.keys(out).length > 0 ? out : null;
  }

  private coerce(v: unknown): string | number | boolean | string[] | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) {
      const arr = v.map((x) => String(x));
      return arr;
    }
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if ('amount' in o) return Number(o.amount);
      if ('value' in o) return this.coerce(o.value);
      return JSON.stringify(v);
    }
    return String(v);
  }
}

export const llmExtractor = new LlmExtractor();


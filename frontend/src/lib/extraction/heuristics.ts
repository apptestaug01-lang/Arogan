import type { Confidence } from './types';
import type { FieldDefinition, FieldStrategy } from './fields';

function makeSnippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + length + 60);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

function firstCapture(match: RegExpMatchArray): string {
  for (let i = 1; i < match.length; i += 1) {
    if (match[i]) return match[i];
  }
  return match[0];
}

function strategyConfidence(strategy: FieldStrategy, text: string, matched: boolean): Confidence {
  if (!matched) return 'low';
  if (!strategy.contextKeywords || strategy.contextKeywords.length === 0) return 'high';
  const lower = text.toLowerCase();
  const hasContext = strategy.contextKeywords.some((k) => lower.includes(k.toLowerCase()));
  return hasContext ? 'high' : 'medium';
}

// Pure: given a field definition and a document's extracted text, return the
// best value found (with confidence). No DOM / network access.
export function extractField(def: FieldDefinition, text: string): { value: string; confidence: Confidence } | null {
  for (const strategy of def.strategies) {
    for (const pattern of strategy.patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      let value = firstCapture(match).trim();
      if (strategy.transform) value = strategy.transform(value);
      if (!value) continue;
      const confidence = strategyConfidence(strategy, text, true);
      return { value, confidence };
    }
  }
  return null;
}

export { makeSnippet };

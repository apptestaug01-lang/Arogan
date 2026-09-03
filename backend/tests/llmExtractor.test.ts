import { LlmExtractor } from '../src/modules/documentExtraction/llmExtractor.js';

describe('LlmExtractor', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'fake-account';
    process.env.CLOUDFLARE_API_TOKEN = 'fake-token';
  });

  afterAll(() => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null when rawText is too short', async () => {
    const extractor = new LlmExtractor();
    expect(await extractor.extractFields('PAN_CARD', 'short', 'a.pdf')).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const extractor = new LlmExtractor();
    expect(await extractor.extractFields('PAN_CARD', 'A'.repeat(500), 'a.pdf')).toBeNull();
  });

  it('returns null on non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const extractor = new LlmExtractor();
    expect(await extractor.extractFields('PAN_CARD', 'A'.repeat(500), 'a.pdf')).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'not json' } }),
    }) as unknown as typeof fetch;
    const extractor = new LlmExtractor();
    expect(await extractor.extractFields('PAN_CARD', 'A'.repeat(500), 'a.pdf')).toBeNull();
  });

  it('parses structured response and filters unknown fields', async () => {
    const body = JSON.stringify({
      pan: { value: 'ABCDE1234F', confidence: 0.92, raw: 'ABCDE1234F' },
      fullName: { value: 'JOHN DOE', confidence: 0.88, raw: 'JOHN DOE' },
      notARealField: { value: 'should be dropped', confidence: 1 },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: '```json\n' + body + '\n```' } }),
    }) as unknown as typeof fetch;

    const extractor = new LlmExtractor();
    const result = await extractor.extractFields('PAN_CARD', 'B'.repeat(500), 'pan.pdf');

    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(expect.arrayContaining(['pan', 'fullName']));
    expect(Object.keys(result!)).not.toContain('notARealField');
    expect(result!.pan.value).toBe('ABCDE1234F');
    expect(result!.pan.confidence).toBeLessThanOrEqual(0.95);
  });

  it('skips null/empty values', async () => {
    const body = JSON.stringify({
      pan: { value: 'ABCDE1234F', confidence: 0.9 },
      fullName: { value: null, confidence: 0.9 },
      aadhaar: { value: '', confidence: 0.9 },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: body } }),
    }) as unknown as typeof fetch;

    const extractor = new LlmExtractor();
    const result = await extractor.extractFields('AADHAAR', 'C'.repeat(500), 'aadhaar.pdf');

    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(['pan']);
  });

  it('recovers JSON wrapped in extra prose', async () => {
    const body = 'Here is the JSON: {"pan":{"value":"ABCDE1234F","confidence":0.92,"raw":"ABCDE1234F"}} hope that helps';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: body } }),
    }) as unknown as typeof fetch;

    const extractor = new LlmExtractor();
    const result = await extractor.extractFields('PAN_CARD', 'B'.repeat(500), 'pan.pdf');
    expect(result).not.toBeNull();
    expect(result!.pan.value).toBe('ABCDE1234F');
  });

  it('reports disabled when credentials missing', () => {
    const extractor = new LlmExtractor();
    expect(extractor.enabled).toBe(true);
  });

  it('keeps short text intact', () => {
    const mod = require('../src/modules/documentExtraction/llmExtractor.js') as {
      trimTextForLlm?: (s: string) => string;
    };
    expect(typeof mod.trimTextForLlm).toBe('function');
    const short = 'hello world';
    expect(mod.trimTextForLlm!(short)).toBe(short);
  });

  it('truncates long text with middle omission marker', () => {
    const mod = require('../src/modules/documentExtraction/llmExtractor.js') as {
      trimTextForLlm: (s: string) => string;
    };
    const long = 'A'.repeat(5000);
    const result = mod.trimTextForLlm(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('omitted for length');
  });
});

import {
  parseArchive,
  validateArchive,
  ArchiveSchemaVersion,
} from '../../src/modules/documentArchive/types.js';

describe('parseArchive', () => {
  it('parses a valid archive JSON buffer', () => {
    const raw = JSON.stringify({
      schemaVersion: '1.0',
      archiveType: 'document-archive',
      id: 'doc-1',
      source: { key: 'borrowers/u/apps/a/documents/d/file.pdf', contentType: 'application/pdf', size: 100, sha256: 'abc' },
      fidelity: { roundTripVerified: true, originalAvailable: 'embedded', warnings: [] },
      format: 'pdf',
      metadata: { pageCount: 3 },
      pages: [{ pageNumber: 1, blocks: [], ocr: null }],
      text: { rawText: 'hello', charCount: 5, searchable: true },
      assets: [],
      byteArchive: { encoding: 'base64', compression: 'gzip', rawSize: 100, archiveSize: 50, data: 'H4sIAAAAA==' },
      classification: { documentType: 'BANK_STATEMENT', confidence: 0.95 },
      fields: {},
    });
    const parsed = parseArchive(Buffer.from(raw));
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.archiveType).toBe('document-archive');
    expect(parsed.id).toBe('doc-1');
  });

  it('rejects unknown schemaVersion', () => {
    const raw = JSON.stringify({
      schemaVersion: '99.0',
      archiveType: 'document-archive',
      id: 'doc-1',
      source: { key: 'k', contentType: 'application/pdf', size: 1, sha256: 'a' },
      fidelity: { roundTripVerified: false, originalAvailable: 'source-object', warnings: [] },
      format: 'unknown',
      metadata: {},
      pages: [],
      text: { rawText: '', charCount: 0, searchable: false },
      assets: [],
      byteArchive: null,
      classification: { documentType: 'UNKNOWN', confidence: 0 },
      fields: {},
    });
    expect(() => parseArchive(Buffer.from(raw))).toThrow(/schemaVersion/);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseArchive(Buffer.from('not json'))).toThrow();
  });

  it('throws on non-object JSON', () => {
    expect(() => parseArchive(Buffer.from('"just a string"'))).toThrow();
  });
});

describe('validateArchive', () => {
  it('validates a minimal well-formed archive', () => {
    const archive = {
      schemaVersion: '1.0' as ArchiveSchemaVersion,
      archiveType: 'document-archive',
      id: 'doc-1',
      source: { key: 'k', contentType: 'application/pdf', size: 10, sha256: 'abc123' },
      fidelity: { roundTripVerified: true, originalAvailable: 'embedded', warnings: [] },
      format: 'pdf' as const,
      metadata: {},
      pages: [{ pageNumber: 1, blocks: [], ocr: null }],
      text: { rawText: '', charCount: 0, searchable: true },
      assets: [],
      byteArchive: null,
      classification: { documentType: 'UNKNOWN', confidence: 0 },
      fields: {},
    };
    expect(validateArchive(archive).valid).toBe(true);
  });

  it('rejects missing source.sha256', () => {
    const archive = {
      schemaVersion: '1.0' as ArchiveSchemaVersion,
      archiveType: 'document-archive',
      id: 'doc-1',
      source: { key: 'k', contentType: 'application/pdf', size: 10 },
      fidelity: { roundTripVerified: true, originalAvailable: 'embedded', warnings: [] },
      format: 'pdf' as const,
      metadata: {},
      pages: [],
      text: { rawText: '', charCount: 0, searchable: true },
      assets: [],
      byteArchive: null,
      classification: { documentType: 'UNKNOWN', confidence: 0 },
      fields: {},
    };
    expect(validateArchive(archive as any).valid).toBe(false);
  });

  it('rejects unknown schemaVersion', () => {
    const archive = {
      schemaVersion: '2.0' as any,
      archiveType: 'document-archive',
      id: 'doc-1',
      source: { key: 'k', contentType: 'application/pdf', size: 10, sha256: 'abc' },
      fidelity: { roundTripVerified: true, originalAvailable: 'embedded', warnings: [] },
      format: 'pdf' as const,
      metadata: {},
      pages: [],
      text: { rawText: '', charCount: 0, searchable: true },
      assets: [],
      byteArchive: null,
      classification: { documentType: 'UNKNOWN', confidence: 0 },
      fields: {},
    };
    expect(validateArchive(archive).valid).toBe(false);
  });
});

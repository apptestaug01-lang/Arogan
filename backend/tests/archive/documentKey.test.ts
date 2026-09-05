import {
  buildArchiveKey,
  buildArchiveAssetKey,
  buildArchiveOriginalKey,
} from '../../src/utils/documentKey.js';

describe('buildArchiveKey', () => {
  it('builds a hidden-namespace archive JSON key for a document', () => {
    const key = buildArchiveKey('doc-123');
    expect(key).toBe('.loanflow/doc-123/document.json');
  });

  it('builds a manifest key', () => {
    const key = buildArchiveKey('doc-456', 'manifest');
    expect(key).toBe('.loanflow/doc-456/manifest.json');
  });

  it('sanitizes the documentId segment', () => {
    const key = buildArchiveKey('doc/../evil');
    expect(key).not.toContain('..');
  });
});

describe('buildArchiveAssetKey', () => {
  it('builds an asset key under the document assets folder', () => {
    const key = buildArchiveAssetKey('doc-1', 'media-0001.png');
    expect(key).toBe('.loanflow/doc-1/assets/media-0001.png');
  });

  it('builds an original.gz key', () => {
    const key = buildArchiveOriginalKey('doc-1');
    expect(key).toBe('.loanflow/doc-1/original.gz');
  });

  it('sanitizes the asset name', () => {
    const key = buildArchiveAssetKey('doc-1', '../escape.png');
    expect(key).not.toContain('..');
    expect(key).toMatch(/assets\/[^/]+\.png$/);
  });
});

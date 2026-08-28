import { buildDocumentKey } from '../src/utils/documentKey.js';

describe('buildDocumentKey', () => {
  it('builds a user-scoped key from the given ids', () => {
    const key = buildDocumentKey('user-1', 'app-1', 'KYC', 'doc-1', 'aadhar.pdf');
    expect(key).toBe('borrowers/user-1/applications/app-1/documents/KYC/doc-1/aadhar.pdf');
  });

  it('strips path-traversal and unsafe characters from every segment', () => {
    const key = buildDocumentKey('user/../x', 'app', 'cat', 'doc', '../../evil.exe')
    const parts = key.split('/')
    expect(parts).toHaveLength(8)
    expect(parts).not.toContain('..')
    expect(parts[0]).toBe('borrowers')
    expect(key).toMatch(/evil\.exe$/)
  });
});

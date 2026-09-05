import { chooseByteTier } from '../../src/modules/documentArchive/integrity.js';

describe('chooseByteTier', () => {
  it('returns embedded for files <= 25 MB', () => {
    expect(chooseByteTier(25 * 1024 * 1024)).toBe('embedded');
    expect(chooseByteTier(1_000_000)).toBe('embedded');
  });

  it('returns gz-object for files > 25 MB and <= 100 MB', () => {
    expect(chooseByteTier(25 * 1024 * 1024 + 1)).toBe('gz-object');
    expect(chooseByteTier(50 * 1024 * 1024)).toBe('gz-object');
    expect(chooseByteTier(100 * 1024 * 1024)).toBe('gz-object');
  });

  it('returns source-object for files > 100 MB', () => {
    expect(chooseByteTier(100 * 1024 * 1024 + 1)).toBe('source-object');
  });
});

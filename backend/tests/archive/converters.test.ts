import { ArchiveConverterRegistry, ArchiveConverter, ConvertContext, ArchiveBuild } from '../../src/modules/documentArchive/converters/index.js';

describe('ArchiveConverterRegistry', () => {
  it('registers and resolves converters by content type', () => {
    const conv: ArchiveConverter = {
      supportedTypes: ['application/pdf'],
      convert: async (_ctx: ConvertContext): Promise<ArchiveBuild> => ({
        format: 'pdf', metadata: {}, pages: [], text: { rawText: '', charCount: 0, searchable: true },
        assets: [], byteArchive: null, warnings: [],
      }),
    };
    const reg = new ArchiveConverterRegistry([conv]);
    expect(reg.getConverter('application/pdf')).toBe(conv);
  });

  it('returns undefined for unregistered content types', () => {
    const reg = new ArchiveConverterRegistry([]);
    expect(reg.getConverter('application/x-fake')).toBeUndefined();
  });

  it('lists all supported types', () => {
    const reg = new ArchiveConverterRegistry([
      { supportedTypes: ['application/pdf'], convert: async () => makeStub() },
      { supportedTypes: ['image/png', 'image/jpeg'], convert: async () => makeStub() },
    ]);
    const types = reg.getSupportedTypes();
    expect(types).toContain('application/pdf');
    expect(types).toContain('image/png');
    expect(types).toContain('image/jpeg');
  });
});

function makeStub(): ArchiveBuild {
  return {
    format: 'unknown',
    metadata: {},
    pages: [],
    text: { rawText: '', charCount: 0, searchable: false },
    assets: [],
    byteArchive: null,
    warnings: [],
  };
}

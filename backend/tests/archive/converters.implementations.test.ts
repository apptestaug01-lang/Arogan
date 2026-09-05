import { ArchiveConverter } from '../../src/modules/documentArchive/converters/index.js';
import { ConvertContext, ArchiveBuild } from '../../src/modules/documentArchive/converters/index.js';

describe('ArchiveConverter implementations', () => {
  describe('PdfConverter', () => {
    let converter: ArchiveConverter;

    beforeAll(async () => {
      const mod = await import('../../src/modules/documentArchive/converters/pdf.js');
      converter = mod.PdfConverter;
    });

    it('supports application/pdf', () => {
      expect(converter.supportedTypes).toContain('application/pdf');
    });

    it('returns a structured archive with metadata and pages for text PDF', async () => {
      const pdfText = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [] >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n108\n%%EOF';
      const ctx: ConvertContext = {
        documentId: 'doc-1',
        sourceKey: 'borrowers/u/apps/a/documents/d/test.pdf',
        fileName: 'test.pdf',
        contentType: 'application/pdf',
        body: Buffer.from(pdfText, 'utf-8'),
        sourceSize: pdfText.length,
        sourceSha256: 'abc123',
      };
      const result = await converter.convert(ctx);
      expect(result.format).toBe('pdf');
      expect(result.metadata).toBeDefined();
      expect(Array.isArray(result.pages)).toBe(true);
      expect(result.text).toBeDefined();
      expect(result.text.charCount).toBeGreaterThanOrEqual(0);
    });

    it('returns a warning for empty or invalid PDF content', async () => {
      const ctx: ConvertContext = {
        documentId: 'doc-1',
        sourceKey: 'borrowers/u/apps/a/documents/d/empty.pdf',
        fileName: 'empty.pdf',
        contentType: 'application/pdf',
        body: Buffer.from('', 'utf-8'),
        sourceSize: 0,
        sourceSha256: 'abc123',
      };
      const result = await converter.convert(ctx);
      expect(result.warnings).toContain('empty-content');
    });
  });

  describe('DocxConverter', () => {
    let converter: ArchiveConverter;

    beforeAll(async () => {
      const mod = await import('../../src/modules/documentArchive/converters/docx.js');
      converter = mod.DocxConverter;
    });

    it('supports docx content types', () => {
      expect(converter.supportedTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
  });

  describe('XlsxConverter', () => {
    let converter: ArchiveConverter;

    beforeAll(async () => {
      const mod = await import('../../src/modules/documentArchive/converters/xlsx.js');
      converter = mod.XlsxConverter;
    });

    it('supports xlsx and csv content types', () => {
      expect(converter.supportedTypes).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(converter.supportedTypes).toContain('text/csv');
    });
  });

  describe('ImageConverter', () => {
    let converter: ArchiveConverter;

    beforeAll(async () => {
      const mod = await import('../../src/modules/documentArchive/converters/image.js');
      converter = mod.ImageConverter;
    });

    it('supports image content types', () => {
      expect(converter.supportedTypes).toContain('image/png');
      expect(converter.supportedTypes).toContain('image/jpeg');
      expect(converter.supportedTypes).toContain('image/webp');
    });

    it('returns a valid archive for image buffer', async () => {
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
        0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
        0x42, 0x60, 0x82,
      ]);
      const ctx: ConvertContext = {
        documentId: 'doc-1',
        sourceKey: 'borrowers/u/apps/a/documents/d/img.png',
        fileName: 'img.png',
        contentType: 'image/png',
        body: pngHeader,
        sourceSize: pngHeader.length,
        sourceSha256: 'abc123',
      };
      const result: ArchiveBuild = await converter.convert(ctx);
      expect(result.format).toBe('image');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.width).toBeDefined();
      expect(result.metadata.height).toBeDefined();
    });
  });

  describe('UnknownConverter', () => {
    let converter: ArchiveConverter;

    beforeAll(async () => {
      const mod = await import('../../src/modules/documentArchive/converters/unknown.js');
      converter = mod.UnknownConverter;
    });

    it('supports any content type as fallback', () => {
      expect(converter.supportedTypes).toEqual(['*']);
    });

    it('returns a structured error archive for unknown formats', async () => {
      const ctx: ConvertContext = {
        documentId: 'doc-1',
        sourceKey: 'borrowers/u/apps/a/documents/d/file.dat',
        fileName: 'file.dat',
        contentType: 'application/octet-stream',
        body: Buffer.from('unknown'),
        sourceSize: 7,
        sourceSha256: 'abc123',
      };
      const result = await converter.convert(ctx);
      expect(result.format).toBe('unknown');
      expect(result.warnings).toContain('unsupported-content-type');
    });
  });

  describe('ArchiveConverterRegistry', () => {
    it('finds a converter for application/pdf', async () => {
      const { ArchiveConverterRegistry } = await import('../../src/modules/documentArchive/converters/index.js');
      const { PdfConverter } = await import('../../src/modules/documentArchive/converters/pdf.js');
      const { DocxConverter } = await import('../../src/modules/documentArchive/converters/docx.js');
      const { XlsxConverter } = await import('../../src/modules/documentArchive/converters/xlsx.js');
      const { ImageConverter } = await import('../../src/modules/documentArchive/converters/image.js');
      const { UnknownConverter } = await import('../../src/modules/documentArchive/converters/unknown.js');

      const reg = new ArchiveConverterRegistry([
        PdfConverter, DocxConverter, XlsxConverter, ImageConverter, UnknownConverter,
      ]);
      expect(reg.getConverter('application/pdf')).toBe(PdfConverter);
      expect(reg.getConverter('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(XlsxConverter);
      expect(reg.getConverter('text/csv')).toBe(XlsxConverter);
      expect(reg.getConverter('image/png')).toBe(ImageConverter);
      expect(reg.getConverter('application/octet-stream')).toBe(UnknownConverter);
    });
  });
});

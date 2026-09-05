import type { ArchiveConverter, ConvertContext, ArchiveBuild } from './index.js';

export const PdfConverter: ArchiveConverter = {
  supportedTypes: ['application/pdf'],

  async convert(ctx: ConvertContext): Promise<ArchiveBuild> {
    const warnings: string[] = [];
    const pages: ArchiveBuild['pages'] = [];
    let rawText = '';

    if (ctx.body.length === 0) {
      warnings.push('empty-content');
      return {
        format: 'pdf',
        metadata: { pageCount: 0 },
        pages,
        text: { rawText: '', charCount: 0, searchable: false },
        assets: [],
        byteArchive: null,
        warnings,
      };
    }

    try {
      const { default: pdf } = await import('pdf-parse');
      const data = await pdf(ctx.body);

      rawText = data.text ?? '';

      const numPages = data.numpages ?? 0;
      const metadata: Record<string, unknown> = {
        pageCount: numPages,
        title: data.info?.Title ?? null,
        author: data.info?.Author ?? null,
        subject: data.info?.Subject ?? null,
        creator: data.info?.Creator ?? null,
        producer: data.info?.Producer ?? null,
        creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate).toISOString() : null,
        modDate: data.info?.ModDate ? new Date(data.info.ModDate).toISOString() : null,
        pdfVersion: data.info?.PDFVersion ?? null,
      };

      const pageTexts = rawText.split(/\f/).filter((t) => t.trim().length > 0);

      if (pageTexts.length > 0 && pageTexts.length <= numPages) {
        pageTexts.forEach((text, idx) => {
          pages.push({
            pageNumber: idx + 1,
            blocks: [{ kind: 'text', bbox: [0, 0, 0, 0], text: text.trim() }],
            ocr: null,
          });
        });
      } else if (rawText.trim().length > 0) {
        pages.push({
          pageNumber: 1,
          blocks: [{ kind: 'text', bbox: [0, 0, 0, 0], text: rawText.trim() }],
          ocr: null,
        });
      }

      if (rawText.trim().length <= 20 && numPages > 0) {
        warnings.push('ocr-fallback-needed');
      }

      return {
        format: 'pdf',
        metadata,
        pages,
        text: {
          rawText,
          charCount: rawText.length,
          searchable: rawText.trim().length > 0,
        },
        assets: [],
        byteArchive: null,
        warnings,
      };
    } catch (err) {
      return {
        format: 'pdf',
        metadata: { pageCount: 0 },
        pages,
        text: { rawText, charCount: rawText.length, searchable: false },
        assets: [],
        byteArchive: null,
        warnings: [`pdf-parse-failed: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  },
};

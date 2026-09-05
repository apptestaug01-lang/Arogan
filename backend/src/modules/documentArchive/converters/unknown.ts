import type { ArchiveConverter, ConvertContext, ArchiveBuild } from './index.js';

export const UnknownConverter: ArchiveConverter = {
  supportedTypes: ['*'],

  async convert(ctx: ConvertContext): Promise<ArchiveBuild> {
    const warnings = [
      'unsupported-content-type',
      `content-type: ${ctx.contentType}`,
      `detected-as-binary`,
    ];

    const hasText = ctx.body.toString('utf-8').trim().length > 0;
    const rawText = hasText ? ctx.body.toString('utf-8').slice(0, 4096) : '';

    return {
      format: 'unknown',
      metadata: {
        originalName: ctx.fileName,
        contentType: ctx.contentType,
        detectedContentType: ctx.detectedContentType ?? ctx.contentType,
      },
      pages: hasText
        ? [{
            pageNumber: 1,
            blocks: [{ kind: 'text', bbox: [0, 0, 0, 0], text: rawText }],
            ocr: null,
          }]
        : [],
      text: {
        rawText,
        charCount: rawText.length,
        searchable: hasText,
      },
      assets: [],
      byteArchive: null,
      warnings,
    };
  },
};

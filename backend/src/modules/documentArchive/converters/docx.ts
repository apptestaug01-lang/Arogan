import type { ArchiveConverter, ConvertContext, ArchiveBuild } from './index.js';
import type { ArchiveAsset } from '../types.js';

export const DocxConverter: ArchiveConverter = {
  supportedTypes: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],

  async convert(ctx: ConvertContext): Promise<ArchiveBuild> {
    const warnings: string[] = [];
    const assets: ArchiveAsset[] = [];

    if (ctx.body.length === 0) {
      warnings.push('empty-content');
      return {
        format: 'docx',
        metadata: {},
        pages: [],
        text: { rawText: '', charCount: 0, searchable: false },
        assets,
        byteArchive: null,
        warnings,
      };
    }

    try {
      const { default: AdmZip } = await import('adm-zip');

      const zip = new AdmZip(ctx.body as unknown as string);
      const entries = zip.getEntries();

      const mediaAssets: ArchiveAsset[] = [];
      let coreProps: Record<string, unknown> = {};

      for (const entry of entries) {
        const entryName = entry.entryName;

        // Zip-slip hardening: reject absolute or parent-traversal paths
        if (entryName.startsWith('/') || entryName.includes('..')) {
          warnings.push(`zip-slip-rejected: ${entryName}`);
          continue;
        }

        if (entryName.startsWith('docProps/core.xml')) {
      try {
          const text = entry.getData().toString('utf8');
          coreProps = parseCoreXml(text);
        } catch {
            warnings.push('core-props-parse-failed');
          }
        }

        if (entryName.startsWith('word/media/')) {
          const data = entry.getData();
          const buf = Buffer.from(data);
          const { sha256 } = await import('../integrity.js');
          const hash = await sha256(buf);
          const assetName = entryName.split('/').pop() || entryName;
          mediaAssets.push({
            name: assetName,
            key: '',
            sha256: hash,
            size: buf.length,
          });
        }
      }

      const mammoth = await import('mammoth');
      const textResult = await mammoth.extractRawText({ buffer: ctx.body });
      const htmlResult = await mammoth.convertToHtml({ buffer: ctx.body });

      const rawText = textResult.value;
      const blocks = htmlResult.value
        .split(/(?=<\/?(p|table|tr|td|th|div|h[1-6]|ul|ol|li)>)/i)
        .filter((s) => s.trim().length > 0)
        .map((html, idx) => ({
          kind: 'html',
          bbox: [0, 0, 0, 0],
          html: html.trim(),
          order: idx,
        }));

      const metadata: Record<string, unknown> = {
        ...coreProps,
        wordCount: rawText.trim().split(/\s+/).filter(Boolean).length,
        charCount: rawText.length,
        htmlLength: htmlResult.value.length,
        assetCount: mediaAssets.length,
        messages: textResult.messages.length > 0 ? textResult.messages : undefined,
      };

      const pages: ArchiveBuild['pages'] = [
        {
          pageNumber: 1,
          blocks,
          ocr: null,
        },
      ];

      if (mediaAssets.length === 0 && htmlResult.value.length > 0 && !htmlResult.value.includes('<img')) {
        warnings.push('no-media-extracted');
      }

      return {
        format: 'docx',
        metadata,
        pages,
        text: {
          rawText,
          charCount: rawText.length,
          searchable: rawText.trim().length > 0,
        },
        assets: mediaAssets,
        byteArchive: null,
        warnings,
      };
    } catch (err) {
      return {
        format: 'docx',
        metadata: {},
        pages: [],
        text: { rawText: '', charCount: 0, searchable: false },
        assets,
        byteArchive: null,
        warnings: [`docx-conversion-failed: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  },
};

function parseCoreXml(xml: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const fields = ['title', 'author', 'subject', 'description', 'creator', 'producer', 'keywords'];
  for (const field of fields) {
    const match = xml.match(new RegExp(`<dc:${field}>(.*?)</dc:${field}>`, 's'));
    if (match) props[field] = match[1].trim();
  }
  return props;
}

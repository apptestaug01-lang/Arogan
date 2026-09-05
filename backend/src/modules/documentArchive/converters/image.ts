import type { ArchiveConverter, ConvertContext, ArchiveBuild } from './index.js';
import type { ArchiveAsset } from '../types.js';

export const ImageConverter: ArchiveConverter = {
  supportedTypes: ['image/png', 'image/jpeg', 'image/webp'],

  async convert(ctx: ConvertContext): Promise<ArchiveBuild> {
    const warnings: string[] = [];
    const assets: ArchiveAsset[] = [];

    if (ctx.body.length === 0) {
      warnings.push('empty-content');
      return {
        format: 'image',
        metadata: {},
        pages: [],
        text: { rawText: '', charCount: 0, searchable: false },
        assets,
        byteArchive: null,
        warnings,
      };
    }

    try {
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(ctx.body).metadata();

      const imageWidth = metadata.width ?? 0;
      const imageHeight = metadata.height ?? 0;

      const text = await runTesseractOcr(ctx.body, imageWidth, imageHeight);

      const pages: ArchiveBuild['pages'] = [
        {
          pageNumber: 1,
          width: imageWidth,
          height: imageHeight,
          blocks: text ? [{
            kind: 'text',
            bbox: [0, 0, imageWidth, imageHeight],
            text: text.text,
          }] : [],
          ocr: text ? { words: text.words as unknown as Array<Record<string, unknown>>, text: text.text } : null,
        },
      ];

      const rawText = text?.text ?? '';

      return {
        format: 'image',
        metadata: {
          width: imageWidth,
          height: imageHeight,
          format: metadata.format,
          channels: metadata.channels,
          space: metadata.space,
          depth: metadata.depth,
          hasExif: !!metadata.exif,
          hasIcc: !!metadata.icc,
        },
        pages,
        text: {
          rawText,
          charCount: rawText.length,
          searchable: rawText.length > 0,
        },
        assets,
        byteArchive: null,
        warnings,
      };
    } catch (err) {
      return {
        format: 'image',
        metadata: {},
        pages: [],
        text: { rawText: '', charCount: 0, searchable: false },
        assets,
        byteArchive: null,
        warnings: [`image-conversion-failed: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  },
};

interface OcrWord {
  text: string;
  bbox: [number, number, number, number];
  conf: number;
}

async function runTesseractOcr(
  body: Buffer,
  _width: number,
  _height: number,
): Promise<{ text: string; words: OcrWord[] } | null> {
  const { spawn } = await import('child_process');
  const { mkdtemp, readFile, rm } = await import('fs/promises');
  const { join } = await import('path');
  const { tmpdir } = await import('os');
  const sharp = (await import('sharp')).default;

  const tmpDir = await mkdtemp(join(tmpdir(), 'img-ocr-'));
  const processedPath = join(tmpDir, 'processed.png');
  const tsvPath = join(tmpDir, 'output');

  try {
    await sharp(body)
      .grayscale()
      .modulate({ brightness: 1.1 })
      .png()
      .toFile(processedPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('tesseract', [processedPath, tsvPath, '-l', 'eng', 'tsv'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('error', reject);
      proc.on('close', (code: number) => {
        if (code === 0) resolve();
        else reject(new Error(`tesseract exited with code ${code}: ${stderr}`));
      });
    });

    const tsvContent = await readFile(`${tsvPath}.tsv`, 'utf-8');
    const lines = tsvContent.split('\n').slice(1);

    const textParts: string[] = [];
    const words: OcrWord[] = [];

    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 12) continue;
      const text = cols[11];
      const conf = parseInt(cols[10], 10);
      const left = parseInt(cols[6], 10);
      const top = parseInt(cols[7], 10);
      const w = parseInt(cols[8], 10);
      const h = parseInt(cols[9], 10);
      if (text && text.trim() && !isNaN(conf)) {
        textParts.push(text);
        words.push({
          text,
          bbox: [left, top, left + w, top + h],
          conf: conf < 0 ? 0 : conf / 100,
        });
      }
    }

    if (textParts.length === 0) return null;

    return {
      text: textParts.join(' '),
      words,
    };
  } catch {
    return null;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

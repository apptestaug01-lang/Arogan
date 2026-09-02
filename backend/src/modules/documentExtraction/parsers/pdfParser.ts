import pdf from 'pdf-parse';
import { mkdtemp, writeFile, unlink, rm, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';
import { ParsedDocument, PageContent } from '../types.js';

export interface OcrEngine {
  recognize(imagePath: string): Promise<{ text: string; confidence: number }>;
}

export class TesseractOcrEngine implements OcrEngine {
  async recognize(imagePath: string): Promise<{ text: string; confidence: number }> {
    const sharp = await import('sharp');

    const processedPath = imagePath.replace('.png', '-processed.png');

    try {
      await sharp.default(imagePath)
        .grayscale()
        .threshold(128)
        .png()
        .toFile(processedPath);

      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng');

      try {
        const { data } = await worker.recognize(processedPath);
        return { text: data.text, confidence: data.confidence / 100 };
      } finally {
        await worker.terminate();
      }
    } finally {
      await rm(processedPath, { force: true });
    }
  }
}

async function findPdftoppm(): Promise<string> {
  const possiblePaths = [
    'C:\\Users\\mamil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\\poppler-25.07.0\\Library\\bin\\pdftoppm.exe',
    'C:\\Program Files\\poppler-25.07.0\\bin\\pdftoppm.exe',
    'C:\\Program Files (x86)\\poppler-25.07.0\\bin\\pdftoppm.exe',
    'C:\\poppler\\bin\\pdftoppm.exe',
    'pdftoppm',
  ];

  for (const path of possiblePaths) {
    if (path === 'pdftoppm') {
      return path;
    }
    try {
      await stat(path);
      return path;
    } catch {
      continue;
    }
  }

  return 'pdftoppm';
}

async function convertPdfToImages(pdfPath: string): Promise<{ imagePath: string; cleanup: () => Promise<void> }[]> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-ocr-'));
  const outputPrefix = join(tmpDir, 'page');

  const pdftoppmPath = await findPdftoppm();

  return new Promise((resolve, reject) => {
    const args = ['-png', '-r', '300', pdfPath, outputPrefix];
    const proc: ChildProcess = spawn(pdftoppmPath, args);

    let stderr = '';
    proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', async (code: number) => {
      if (code !== 0) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`pdftoppm failed with code ${code}: ${stderr}. Please install poppler-utils from https://github.com/oschwartz10612/poppler-windows`));
        return;
      }

      const results: { imagePath: string; cleanup: () => Promise<void> }[] = [];
      for (let i = 1; i <= 10; i++) {
        const imagePath = `${outputPrefix}-${i}.png`;
        try {
          await stat(imagePath);
          results.push({
            imagePath,
            cleanup: async () => {
              await unlink(imagePath).catch(() => {});
            },
          });
        } catch {
          break;
        }
      }

      if (results.length === 0) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error('No pages converted from PDF'));
        return;
      }

      resolve(results);
    });

    proc.on('error', async (err: Error) => {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      reject(new Error(`Failed to start pdftoppm: ${err.message}. Please install poppler-utils from https://github.com/oschwartz10612/poppler-windows`));
    });
  });
}

export class PdfParser {
  readonly supportedTypes = ['application/pdf'];
  private ocrEngine: OcrEngine | null = null;

  constructor(ocrEngine?: OcrEngine) {
    this.ocrEngine = ocrEngine || null;
  }

  async parse(body: Buffer, fileName: string, documentId: string): Promise<ParsedDocument> {
    const data = await pdf(body);
    const pages: PageContent[] = [];

    if (data.text && data.text.trim().length > 50) {
      const pageTexts = data.text.split(/\f|\n\n\n/);
      pageTexts.forEach((text, idx) => {
        if (text.trim()) {
          pages.push({ pageNumber: idx + 1, text: text.trim() });
        }
      });
    }

    if (pages.length === 0 && data.text && data.text.trim()) {
      pages.push({ pageNumber: 1, text: data.text });
    }

    const needsOcr = (pages.length === 0 || (data.text && data.text.trim().length <= 50)) && this.ocrEngine;

    if (needsOcr) {
      const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-ocr-'));
      const pdfPath = join(tmpDir, 'document.pdf');

      try {
        await writeFile(pdfPath, body);

        try {
          const imageResults = await convertPdfToImages(pdfPath);

          for (const { imagePath, cleanup } of imageResults) {
            try {
              const ocrResult = await this.ocrEngine!.recognize(imagePath);
              if (ocrResult.text.trim()) {
                pages.push({
                  pageNumber: pages.length + 1,
                  text: ocrResult.text,
                  confidence: ocrResult.confidence,
                });
              }
            } finally {
              await cleanup();
            }
          }
        } catch (ocrError) {
          console.error(`  [PdfParser] OCR failed for ${fileName}: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`);
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    return {
      documentId,
      fileName,
      contentType: 'application/pdf',
      pages,
      rawText: pages.map((p) => p.text).join('\n\n'),
    };
  }
}

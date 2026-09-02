import { spawn } from 'child_process';
import { mkdtemp, writeFile, unlink, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface PdfToImageResult {
  pageNumber: number;
  imagePath: string;
}

export class PdfToImageConverter {
  async convert(pdfPath: string, dpi: number = 200): Promise<PdfToImageResult[]> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-ocr-'));
    const outputPrefix = join(tmpDir, 'page');

    return new Promise((resolve, reject) => {
      const args = [
        '-png',
        '-r', dpi.toString(),
        pdfPath,
        outputPrefix,
      ];

      const process = spawn('pdftoppm', args);

      let stderr = '';
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', async (code) => {
        if (code !== 0) {
          await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
          reject(new Error(`pdftoppm failed with code ${code}: ${stderr}`));
          return;
        }

        const results: PdfToImageResult[] = [];
        let pageNum = 1;

        while (true) {
          const imagePath = `${outputPrefix}-${pageNum}.png`;
          try {
            await writeFile(imagePath, Buffer.from(''));
            await unlink(imagePath);
            break;
          } catch {
            results.push({ pageNumber: pageNum, imagePath: `${outputPrefix}-${pageNum}.png` });
            pageNum++;
          }
        }

        if (results.length === 0) {
          await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
          reject(new Error('No pages converted from PDF'));
          return;
        }

        resolve(results);
      });

      process.on('error', (err) => {
        rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`Failed to start pdftoppm: ${err.message}`));
      });
    });
  }

  async convertAndCleanup(pdfPath: string, dpi: number = 200): Promise<{ results: PdfToImageResult[]; cleanup: () => Promise<void> }> {
    const results = await this.convert(pdfPath, dpi);
    const tmpDir = results.length > 0 ? results[0].imagePath.replace(/-\d+\.png$/, '') : '';

    return {
      results,
      cleanup: async () => {
        for (const result of results) {
          await unlink(result.imagePath).catch(() => {});
        }
        if (tmpDir) {
          await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
      },
    };
  }
}

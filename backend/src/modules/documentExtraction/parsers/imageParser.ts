import { ParsedDocument, PageContent } from '../types.js';

export interface OcrEngine {
  recognize(imagePath: string): Promise<{ text: string; confidence: number }>;
}

export class ImageParser {
  readonly supportedTypes = ['image/png', 'image/jpeg', 'image/webp'];

  constructor(private ocrEngine?: OcrEngine) {}

  async parse(body: Buffer, fileName: string, documentId: string): Promise<ParsedDocument> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'img-ocr-'));
    const ext = path.extname(fileName) || '.png';
    const tmpPath = path.join(tmpDir, `image${ext}`);

    try {
      await fs.writeFile(tmpPath, body);

      let text = '';
      let confidence = 0;

      if (this.ocrEngine) {
        const result = await this.ocrEngine.recognize(tmpPath);
        text = result.text;
        confidence = result.confidence;
      }

      const page: PageContent = { pageNumber: 1, text, confidence };

      return {
        documentId,
        fileName,
        contentType: 'image/*',
        pages: [page],
        rawText: text,
      };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

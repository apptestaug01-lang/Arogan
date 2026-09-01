import pdf from 'pdf-parse';
import { ParsedDocument, PageContent } from '../types.js';

export interface PdfToImageConverter {
  convert(pdfPath: string): Promise<string[]>;
}

export class PdfParser {
  readonly supportedTypes = ['application/pdf'];

  constructor(private pdfToImageConverter?: PdfToImageConverter) {}

  async parse(body: Buffer, fileName: string, documentId: string): Promise<ParsedDocument> {
    const data = await pdf(body);
    const pages: PageContent[] = [];

    if (data.text && data.text.trim().length > 10) {
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

    if (pages.length === 0 || (data.text && data.text.trim().length <= 10)) {
      console.log(`  [PdfParser] Text extraction yielded minimal content for ${fileName}, may need OCR`);
    }

    return {
      documentId,
      fileName,
      contentType: 'application/pdf',
      pages,
      rawText: data.text || '',
    };
  }
}

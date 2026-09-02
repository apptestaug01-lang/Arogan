import { ParsedDocument } from '../types.js';
import { PdfParser, TesseractOcrEngine } from './pdfParser.js';
import { ImageParser, OcrEngine } from './imageParser.js';
import { DocxParser, XlsxParser } from './officeParser.js';

export type DocumentParser = {
  readonly supportedTypes: string[];
  parse(body: Buffer, fileName: string, documentId: string): Promise<ParsedDocument>;
};

export class ParserRegistry {
  private parsers: DocumentParser[] = [];

  constructor(ocrEngine?: OcrEngine) {
    const tesseractEngine = new TesseractOcrEngine();
    this.parsers.push(new PdfParser(tesseractEngine));
    this.parsers.push(new ImageParser(ocrEngine || tesseractEngine));
    this.parsers.push(new DocxParser());
    this.parsers.push(new XlsxParser());
  }

  getParser(contentType: string): DocumentParser | undefined {
    return this.parsers.find((p) => p.supportedTypes.includes(contentType));
  }

  getSupportedTypes(): string[] {
    return this.parsers.flatMap((p) => p.supportedTypes);
  };
}

import { ParsedDocument, PageContent } from '../types.js';

export class DocxParser {
  readonly supportedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];

  async parse(body: Buffer, fileName: string, documentId: string): Promise<ParsedDocument> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: body });

    const pages: PageContent[] = [{ pageNumber: 1, text: result.value }];

    return {
      documentId,
      fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pages,
      rawText: result.value,
    };
  }
}

export class XlsxParser {
  readonly supportedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ];

  async parse(body: Buffer, fileName: string, documentId: string): Promise<ParsedDocument> {
    const xlsx = await import('xlsx');
    const workbook = xlsx.read(body, { type: 'buffer' });

    const fullText: string[] = [];
    const pages: PageContent[] = [];

    workbook.SheetNames.forEach((sheetName, idx) => {
      const sheet = workbook.Sheets[sheetName];
      const csvData = xlsx.utils.sheet_to_csv(sheet);
      const jsonData = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });

      const sheetText = [`=== Sheet: ${sheetName} ===`, csvData, JSON.stringify(jsonData, null, 2)].join('\n');
      fullText.push(sheetText);
      pages.push({ pageNumber: idx + 1, text: sheetText });
    });

    return {
      documentId,
      fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pages,
      rawText: fullText.join('\n\n'),
    };
  }
}

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
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
      throw new Error(
        `Legacy .xls (BIFF) format is not supported. Please re-save the file as .xlsx (Office 2007+) and re-upload. File: ${fileName}`,
      );
    }

    const xlsx = await import('xlsx');
    let workbook;
    try {
      workbook = xlsx.read(body, { type: 'buffer' });
    } catch (e) {
      throw new Error(
        `Failed to parse spreadsheet (${fileName}): ${e instanceof Error ? e.message : String(e)}. If this is a legacy .xls file, please re-save as .xlsx.`,
      );
    }

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

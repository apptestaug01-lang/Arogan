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
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    'text/csv',
  ];

  async parse(body: Buffer, fileName: string, documentId: string): Promise<ParsedDocument> {
    const xlsx = await import('xlsx');
    let workbook;
    try {
      workbook = xlsx.read(body, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to parse spreadsheet (${fileName}): ${msg}. ` +
          `Supported formats: .xlsx (OOXML), .xls (legacy BIFF8), .csv. ` +
          `If the file is password-protected, corrupted, or uses an older Excel format, ` +
          `please open it in Excel and re-save as .xlsx.`,
      );
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(
        `Spreadsheet ${fileName} contains no readable sheets. ` +
          `The file may be empty, password-protected, or in a format not supported by this version of Excel. ` +
          `Please open it in Excel and re-save as .xlsx.`,
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

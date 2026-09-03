import { XlsxParser } from '../src/modules/documentExtraction/parsers/officeParser.js';
import * as xlsx from 'xlsx';

describe('XlsxParser', () => {
  const parser = new XlsxParser();

  it('parses a generated .xlsx file', async () => {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ['Item', 'Amount'],
      ['Revenue', 1000000],
      ['Expenses', 750000],
      ['Profit', 250000],
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'P&L');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parser.parse(buf, 'test.xlsx', 'doc-1');

    expect(result.rawText).toContain('P&L');
    expect(result.rawText).toContain('Revenue');
    expect(result.rawText).toContain('250000');
    expect(result.pages.length).toBe(1);
    expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('attempts to parse a real legacy .xls fixture (Pulse FS Mar-24) if present', async () => {
    const path = 'C:/Arogan/BusinessLoanApp/test-fixtures/legacy-pulse-fs.xls';
    let fs: typeof import('fs');
    try {
      fs = await import('fs');
      if (!fs.existsSync(path)) {
        return;
      }
    } catch {
      return;
    }
    const buf = fs.readFileSync(path);
    const result = await parser.parse(buf, 'legacy-pulse-fs.xls', 'doc-real');
    expect(result.rawText.length).toBeGreaterThan(0);
    expect(result.pages.length).toBeGreaterThan(0);
  });
});


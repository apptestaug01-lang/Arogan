import type { ArchiveConverter, ConvertContext, ArchiveBuild } from './index.js';
import type { ArchiveAsset } from '../types.js';
import { read, utils, type WorkBook, type CellObject, type Range } from 'xlsx';

export const XlsxConverter: ArchiveConverter = {
  supportedTypes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ],

  async convert(ctx: ConvertContext): Promise<ArchiveBuild> {
    const warnings: string[] = [];
    const assets: ArchiveAsset[] = [];

    if (ctx.body.length === 0) {
      warnings.push('empty-content');
      return {
        format: 'unknown',
        metadata: {},
        pages: [],
        text: { rawText: '', charCount: 0, searchable: false },
        assets,
        byteArchive: null,
        warnings,
      };
    }

    try {
      let workbook: WorkBook;
      try {
        workbook = read(ctx.body, {
          type: 'buffer',
          cellFormula: true,
          cellNF: true,
          cellStyles: true,
          cellDates: true,
          cellText: true,
          raw: true,
        });
      } catch (err) {
        return {
          format: ctx.contentType === 'text/csv' ? 'csv' : 'xlsx',
          metadata: {},
          pages: [],
          text: { rawText: '', charCount: 0, searchable: false },
          assets,
          byteArchive: null,
          warnings: [`parse-failed: ${err instanceof Error ? err.message : String(err)}`],
        };
      }

      if (ctx.contentType === 'text/csv') {
        const text = ctx.body.toString('utf8').replace(/^\uFEFF/, '');
        return {
          format: 'csv',
          metadata: { encoding: 'utf-8' },
          pages: [{
            pageNumber: 1,
            blocks: [{ kind: 'text', bbox: [0, 0, 0, 0], text }],
            ocr: null,
          }],
          text: { rawText: text, charCount: text.length, searchable: text.length > 0 },
          assets,
          byteArchive: null,
          warnings,
        };
      }

      const sheetNames: string[] = workbook.SheetNames ?? [];
      if (sheetNames.length === 0) {
        warnings.push('no-sheets-found');
      }

      const pages: ArchiveBuild['pages'] = [];
      const rows: string[] = [];

      for (const [sheetIdx, sheetName] of sheetNames.entries()) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          pages.push({
            pageNumber: sheetIdx + 1,
            blocks: [{ kind: 'text', bbox: [0, 0, 0, 0], text: 'Sheet is undefined' }],
            ocr: null,
          });
          continue;
        }

        const ref = sheet['!ref'] || 'A1';
        let range: Range;
        try {
          range = utils.decode_range(ref);
        } catch {
          range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
        }

        const cells: Array<{ t: string; v: unknown; w?: string; f?: string; z?: string }> = [];
        const grid: Array<Array<{ t: string; v: unknown; w?: string; f?: string }>> = [];

        for (let R = range.s.r; R <= range.e.r; R++) {
          const row: Array<{ t: string; v: unknown; w?: string; f?: string }> = [];
          for (let C = range.s.c; C <= range.e.c; C++) {
            const cellRef = utils.encode_cell({ c: C, r: R });
            const cell = (sheet as Record<string, CellObject>)[cellRef];
            if (cell) {
              const cellData = {
                t: String(cell.t),
                v: cell.v as unknown,
                w: cell.w,
                f: cell.f,
                z: cell.z ? String(cell.z) : undefined,
              };
              row.push(cellData);
              cells.push(cellData);
            } else {
              row.push({ t: 'z', v: '' });
            }
          }
          grid.push(row);
        }

        const csv = utils.sheet_to_csv(sheet);
        rows.push(`=== Sheet: ${sheetName} ===\n${csv}`);

        const block = {
          kind: 'table' as const,
          bbox: [0, 0, 0, 0],
          grid,
          merges: sheet['!merges'] || [],
          colSizes: sheet['!cols'] || [],
          rowSizes: sheet['!rows'] || [],
        };

        pages.push({
          pageNumber: sheetIdx + 1,
          blocks: [block],
          ocr: null,
        });
      }

      const rawText = rows.join('\n\n');

      return {
        format: 'xlsx',
        metadata: {
          sheetCount: sheetNames.length,
          sheetNames,
          fileName: ctx.fileName,
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
        format: 'xlsx',
        metadata: {},
        pages: [],
        text: { rawText: '', charCount: 0, searchable: false },
        assets,
        byteArchive: null,
        warnings: [`xlsx-conversion-failed: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  },
};

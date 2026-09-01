import * as fs from 'fs';
import * as path from 'path';

/**
 * Document text parsers - local, offline, no external APIs
 * Supports: PDF, DOCX, XLSX, CSV, Images (OCR), ZIP
 */

export async function parseDocument(
  filePath: string,
  options: { ocrLanguage?: string; debug?: boolean } = {},
): Promise<{ text: string; pages: string[] }> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    switch (ext) {
      case '.pdf':
        return await parsePdf(filePath);
      case '.docx':
        return await parseDocx(filePath);
      case '.doc':
        return await parseDoc(filePath);
      case '.xlsx':
      case '.xls':
        return await parseXlsx(filePath);
      case '.csv':
        return await parseCsv(filePath);
      case '.txt':
      case '.text':
        return await parseTxt(filePath);
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.webp':
      case '.tiff':
      case '.tif':
        return await parseImage(filePath, options.ocrLanguage || 'eng');
      case '.zip':
        return await parseZip(filePath, options);
      default:
        return { text: '', pages: [] };
    }
  } catch (error) {
    if (options.debug) {
      console.error(`[LocalExtract] Parse error for ${path.basename(filePath)}:`, error);
    }
    return { text: '', pages: [] };
  }
}

async function parsePdf(filePath: string): Promise<{ text: string; pages: string[] }> {
  try {
    // Use pdf-parse for Node.js compatibility (no worker needed)
    const pdfParse = (await import('pdf-parse')).default;
    const data = fs.readFileSync(filePath);
    const result = await pdfParse(data);

    // If no text extracted, try OCR fallback for image-based PDFs
    if (!result.text || result.text.trim().length < 10) {
      console.warn(`[LocalExtract] PDF has no extractable text, trying OCR: ${path.basename(filePath)}`);
      return await parsePdfWithOcr(filePath);
    }

    return { text: result.text, pages: [result.text] };
  } catch (error) {
    console.error('[LocalExtract] PDF parse error:', error);
    return { text: '', pages: [] };
  }
}

async function parsePdfWithOcr(filePath: string): Promise<{ text: string; pages: string[] }> {
  try {
    // Convert PDF to images using pdf2pic
    const { fromPath } = await import('pdf2pic');
    const convert = fromPath(filePath, {
      density: 300,
      format: 'png',
      width: 2480,
      height: 3508,
    });

    const result = await convert(1); // Convert first page only for speed

    if (result.path) {
      // Run OCR on the converted image
      const ocrResult = await parseImage(result.path, 'eng');

      // Cleanup temp file
      try { fs.unlinkSync(result.path); } catch { /* ignore */ }

      return ocrResult;
    }

    return { text: '', pages: [] };
  } catch (error) {
    console.error('[LocalExtract] PDF OCR fallback error:', error);
    return { text: '', pages: [] };
  }
}

async function parseDocx(filePath: string): Promise<{ text: string; pages: string[] }> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value, pages: [result.value] };
  } catch (error) {
    console.error('[LocalExtract] DOCX parse error:', error);
    return { text: '', pages: [] };
  }
}

async function parseDoc(filePath: string): Promise<{ text: string; pages: string[] }> {
  // .doc format is legacy and harder to parse without external tools
  // Return empty and rely on OCR if user provides image version
  console.warn('[LocalExtract] .doc format not directly supported, consider converting to .docx');
  return { text: '', pages: [] };
}

async function parseXlsx(filePath: string): Promise<{ text: string; pages: string[] }> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const allText: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      for (const row of jsonData) {
        const rowText = row.filter((cell: any) => cell != null).map((cell: any) => String(cell)).join(' ');
        if (rowText.trim()) {
          allText.push(rowText);
        }
      }
    }

    const text = allText.join('\n');
    return { text, pages: [text] };
  } catch (error) {
    console.error('[LocalExtract] XLSX parse error:', error);
    return { text: '', pages: [] };
  }
}

async function parseCsv(filePath: string): Promise<{ text: string; pages: string[] }> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { text: content, pages: [content] };
  } catch (error) {
    console.error('[LocalExtract] CSV parse error:', error);
    return { text: '', pages: [] };
  }
}

async function parseTxt(filePath: string): Promise<{ text: string; pages: string[] }> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { text: content, pages: [content] };
  } catch (error) {
    console.error('[LocalExtract] TXT parse error:', error);
    return { text: '', pages: [] };
  }
}

async function parseImage(filePath: string, language: string): Promise<{ text: string; pages: string[] }> {
  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker(language, 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7/tesseract-core-simd.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      gzip: true,
    });

    const result = await worker.recognize(filePath);
    await worker.terminate();

    return { text: result.data.text, pages: [result.data.text] };
  } catch (error) {
    console.error('[LocalExtract] OCR error:', error);
    return { text: '', pages: [] };
  }
}

async function parseZip(
  filePath: string,
  options: { ocrLanguage?: string; debug?: boolean },
): Promise<{ text: string; pages: string[] }> {
  try {
    const AdmZip = await import('adm-zip');
    const zip = new AdmZip.default(filePath);
    const zipEntries = zip.getEntries();

    const allText: string[] = [];
    const allPages: string[] = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const entryExt = path.extname(entry.entryName).toLowerCase();
      const supportedExts = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.tiff'];

      if (!supportedExts.includes(entryExt)) continue;

      // Extract to temp
      const tempPath = filePath + '_' + path.basename(entry.entryName);
      fs.writeFileSync(tempPath, entry.getData());

      const result = await parseDocument(tempPath, options);
      allText.push(result.text);
      allPages.push(...result.pages);

      // Cleanup temp file
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }

    return { text: allText.join('\n\n'), pages: allPages };
  } catch (error) {
    console.error('[LocalExtract] ZIP parse error:', error);
    return { text: '', pages: [] };
  }
}

import { getDocumentView, listDocuments } from '@/services/documents';
import { extractFromTextSources } from './orchestrate';
import type { DocumentTextSource, ExtractionResult, VaultDocumentInput } from './types';

// Per-content-type text extraction. PDFs are parsed with pdfjs-dist; plain text
// is fetched directly. Images are processed with Tesseract.js OCR. DOCX / XLSX
// are not extractable client-side without extra libraries — leave them as empty
// strings and surface a clear extension point.
async function extractTextFromUrl(url: string, contentType: string): Promise<string> {
  if (contentType.startsWith('application/pdf')) {
    try {
      const { loadPdfText } = await import('./pdfText');
      return await loadPdfText(url);
    } catch (error) {
      console.error('[AutoFill] PDF extraction failed:', url, error);
      return '';
    }
  }
  if (contentType.startsWith('text/') || contentType.includes('xml') || contentType === 'text/csv') {
    try {
      const res = await fetch(url);
      return await res.text();
    } catch (error) {
      console.error('[AutoFill] Text extraction failed:', url, error);
      return '';
    }
  }
  if (contentType.startsWith('image/')) {
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng');
      let imageUrl = url;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        imageUrl = URL.createObjectURL(blob);
      } catch {
        // fallback to direct URL if blob fetch fails (CORS, etc.)
      }
      const result = await worker.recognize(imageUrl);
      if (imageUrl !== url) URL.revokeObjectURL(imageUrl);
      await worker.terminate();
      return result.data.text;
    } catch (error) {
      console.error('[AutoFill] OCR failed:', url, error);
      return '';
    }
  }
  console.warn('[AutoFill] Unsupported content type:', contentType, url);
  return '';
}

async function loadDocumentTextSources(docs: VaultDocumentInput[]): Promise<DocumentTextSource[]> {
  const results = await Promise.all(
    docs.map(async (doc): Promise<DocumentTextSource | null> => {
      try {
        const view = await getDocumentView(doc.id);
        const text = await extractTextFromUrl(view.viewUrl, doc.contentType);
        if (!text) {
          console.warn('[AutoFill] No text extracted from:', doc.originalName, doc.contentType);
        }
        return { docId: doc.id, docName: doc.originalName, text };
      } catch (error) {
        console.error('[AutoFill] Failed to load document:', doc.originalName, error);
        return null;
      }
    }),
  );
  const valid = results.filter((r): r is DocumentTextSource => r !== null);
  console.log('[AutoFill] Loaded', valid.length, 'of', docs.length, 'documents');
  return valid;
}

// End-to-end extraction over the live S3 vault for the current application.
export async function extractApplicationData(docs: VaultDocumentInput[]): Promise<ExtractionResult> {
  const sources = await loadDocumentTextSources(docs);
  return extractFromTextSources(sources);
}

// Convenience: pull the current vault listing and extract from it.
export async function autoFillFromVault(): Promise<ExtractionResult> {
  const docs = await listDocuments();
  return extractApplicationData(docs);
}

// Extract from a specific subset of documents.
export async function autoFillFromDocuments(docs: VaultDocumentInput[]): Promise<ExtractionResult> {
  return extractApplicationData(docs);
}

export { extractFromTextSources };

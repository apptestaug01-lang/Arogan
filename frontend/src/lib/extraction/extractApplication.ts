import { getDocumentView, listDocuments } from '@/services/documents';
import { extractFromTextSources } from './orchestrate';
import type { DocumentTextSource, ExtractionResult, VaultDocumentInput } from './types';

// Per-content-type text extraction. PDFs are parsed with pdfjs-dist; plain text
// is fetched directly. Images are processed with Tesseract.js OCR. DOCX / XLSX
// are not extractable client-side without extra libraries — leave them as empty
// strings and surface a clear extension point.
async function extractTextFromUrl(url: string, contentType: string): Promise<string> {
  if (contentType.startsWith('application/pdf')) {
    const { loadPdfText } = await import('./pdfText');
    return loadPdfText(url);
  }
  if (contentType.startsWith('text/') || contentType.includes('xml') || contentType === 'text/csv') {
    const res = await fetch(url);
    return res.text();
  }
  if (contentType.startsWith('image/')) {
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(url, 'eng');
      return result.data.text;
    } catch {
      return '';
    }
  }
  return '';
}

async function loadDocumentTextSources(docs: VaultDocumentInput[]): Promise<DocumentTextSource[]> {
  const results = await Promise.all(
    docs.map(async (doc): Promise<DocumentTextSource | null> => {
      try {
        const view = await getDocumentView(doc.id);
        const text = await extractTextFromUrl(view.viewUrl, doc.contentType);
        return { docId: doc.id, docName: doc.originalName, text };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is DocumentTextSource => r !== null);
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

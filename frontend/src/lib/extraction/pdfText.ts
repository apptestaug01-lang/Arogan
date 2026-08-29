import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Extract plain text from a PDF given a (presigned) URL. Used by the document
// auto-fill pipeline to read KYC / Financials / Sanction-letter PDFs.
export async function loadPdfText(url: string): Promise<string> {
  const pdf = await pdfjsLib.getDocument(url).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (('str' in item ? item.str : '') as string))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(text);
  }
  return pages.join('\n');
}

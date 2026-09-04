import { AutoFillService } from '../modules/documentExtraction/autoFillService.js';
import logger from '../middleware/logger.js';

const autoFillService = new AutoFillService();

/**
 * Kick off document extraction in the background once an upload completes.
 * We do NOT block the upload response on this — extraction can take 10–30s
 * for OCR'd PDFs. The wizard will pick up the warm cache on the next
 * extract-all call (or directly via the status endpoint).
 */
export function triggerExtraction(userId: string, documentId: string): void {
  setImmediate(() => {
    autoFillService
      .extractFromDocument(userId, documentId)
      .then((fields) => {
        const count = fields ? Object.keys(fields).length : 0;
        logger.info(
          { documentId, count },
          '[Extraction] background extraction complete',
        );
      })
      .catch((err) => {
        logger.warn(
          { documentId, err: err instanceof Error ? err.message : String(err) },
          '[Extraction] background extraction failed',
        );
      });
  });
}

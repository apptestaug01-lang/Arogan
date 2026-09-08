import { prisma } from '../lib/prisma.js';
import logger from '../middleware/logger.js';

export async function triggerExtraction(
  userId: string,
  documentId: string,
  retries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { AutoFillService } = await import('../modules/documentExtraction/autoFillService.js');
      const svc = new AutoFillService();
      await svc.extractFromDocument(userId, documentId);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ documentId, attempt, err: msg }, '[triggerExtraction] attempt failed');
      if (attempt === retries) {
        await prisma.documentExtraction
          .updateMany({
            where: { documentId, status: 'processing' },
            data: { status: 'failed', error: `All ${retries} attempts failed: ${msg}` },
          })
          .catch(() => {});
      } else {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
}

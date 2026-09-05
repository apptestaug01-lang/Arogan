import { prisma } from '../../lib/prisma.js';
import logger from '../../middleware/logger.js';
import { deleteObject, listObjects, ListedObject } from '../../services/storage.service.js';
import { LOANFLOW_DERIVED_PREFIX } from '../../utils/constants.js';

export interface SweeperOptions {
  staleThresholdMinutes?: number;
}

export class ArchiveSweeper {
  private options: Required<SweeperOptions>;

  constructor(options: SweeperOptions = {}) {
    this.options = {
      staleThresholdMinutes: options.staleThresholdMinutes ?? 1440,
    };
  }

  async sweepOrphans(): Promise<{ deleted: number; errors: number }> {
    const prefix = LOANFLOW_DERIVED_PREFIX;

    let listed: ListedObject[] = [];
    try {
      listed = await listObjects(prefix);
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, '[Sweeper] Failed to list derived objects');
      return { deleted: 0, errors: 1 };
    }

    const activeDocs = await prisma.document.findMany({
      where: { status: { not: 'DELETED' } },
      select: { id: true, status: true },
    });

    const activeDocIds = new Set(activeDocs.map((d) => d.id));

    const threshold = new Date(Date.now() - this.options.staleThresholdMinutes * 60 * 1000);
    const results = await Promise.allSettled(
      listed.map(async (obj) => {
        const parts = obj.key.split('/');
        if (parts[0] !== prefix) return;

        const docId = parts[1];

        if (!activeDocIds.has(docId)) {
          await deleteObject(obj.key);
          logger.info({ key: obj.key, documentId: docId }, '[Sweeper] Removed orphaned derived object');
          return { deleted: 1 };
        }

        const archiveStatus = await prisma.documentArchive.findUnique({
          where: { documentId: docId },
          select: { status: true, updatedAt: true },
        });

        if (!archiveStatus) {
          if (obj.key.endsWith('document.json') || obj.key.endsWith('manifest.json') || obj.key.endsWith('original.gz')) {
            return { deleted: 0 };
          }
          await deleteObject(obj.key);
          logger.info({ key: obj.key }, '[Sweeper] Removed orphaned asset without archive row');
          return { deleted: 1 };
        }

        if (archiveStatus.status === 'DELETED' || (archiveStatus.status === 'FAILED' && archiveStatus.updatedAt && archiveStatus.updatedAt < threshold)) {
          await deleteObject(obj.key);
          logger.info({ key: obj.key }, '[Sweeper] Removed stale failed archive object');
          return { deleted: 1 };
        }

        return { deleted: 0 };
      }),
    );

    let deleted = 0;
    let errors = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        deleted += result.value?.deleted ?? 0;
      } else {
        errors++;
      }
    }

    logger.info({ deleted, errors, totalListed: listed.length }, '[Sweeper] Sweep complete');
    return { deleted, errors };
  }
}

export const archiveSweeper = new ArchiveSweeper();

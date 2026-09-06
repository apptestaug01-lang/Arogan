import { prisma } from '../../lib/prisma.js';
import { ArchiveService } from './archive.service.js';
import { archiveMetrics } from './metrics.js';
import { listObjects, ListedObject } from '../../services/storage.service.js';
import { LOANFLOW_DERIVED_PREFIX } from '../../utils/constants.js';
import logger from '../../middleware/logger.js';

export interface BackfillOptions {
  concurrency?: number;
  pageSize?: number;
  rateLimitMs?: number;
  dryRun?: boolean;
}

interface BackfillResult {
  enqueued: number;
  completed: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  nextToken?: string | null;
}

const JSON_SUFFIX = '.json';
const DELETED_PREFIX = 'DELETED_';

function shouldSkipKey(key: string): boolean {
  const parts = key.split('/');
  const fileName = parts[parts.length - 1] || '';

  if (parts.includes(LOANFLOW_DERIVED_PREFIX)) return true;
  if (key.includes(`/${LOANFLOW_DERIVED_PREFIX}/`)) return true;
  if (fileName.endsWith(JSON_SUFFIX)) return true;
  if (fileName.startsWith(DELETED_PREFIX)) return true;
  if (fileName === '') return true;

  return false;
}

export class BackfillRunner {
  private service: ArchiveService;
  private options: Required<Omit<BackfillOptions, 'dryRun'>>;

  constructor(service: ArchiveService, options?: BackfillOptions) {
    this.service = service;
    this.options = {
      concurrency: options?.concurrency ?? 2,
      pageSize: options?.pageSize ?? 1000,
      rateLimitMs: options?.rateLimitMs ?? 100,
    };
  }

  async runOnce(opts?: { dryRun?: boolean }): Promise<BackfillResult> {
    const dryRun = opts?.dryRun ?? false;
    const prefix = 'borrowers/';

    logger.info({ prefix, dryRun }, '[Backfill] Starting backfill run');

    let listed: ListedObject[] = [];
    try {
      listed = await listObjects(prefix);
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, '[Backfill] Failed to list objects');
      return { enqueued: 0, completed: 0, failed: 0, skipped: 0, dryRun };
    }

    const candidateDocs = listed
      .filter((o) => !shouldSkipKey(o.key))
      .map((o) => {
        const parts = o.key.split('/');
        const docIdx = parts.indexOf('documents');
        let documentId: string | undefined;
        if (docIdx >= 0 && docIdx + 1 < parts.length) {
          documentId = parts[docIdx + 1];
        }
        return { key: o.key, size: o.size, documentId };
      })
      .filter((d): d is { key: string; size: number; documentId: string } => !!d.documentId);

    const docIds = candidateDocs.map((d) => d.documentId);
    const documents = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: { id: true, userId: true },
    });

    const docMap = new Map(documents.map((d) => [d.id, d.userId]));

    const completedArchives = await prisma.documentArchive.findMany({
      where: { documentId: { in: docIds }, status: 'COMPLETED' },
      select: { documentId: true },
    });

    const completedIds = new Set(completedArchives.map((a) => a.documentId));

    const toEnqueue = candidateDocs.filter(
      (d) => docMap.has(d.documentId) && !completedIds.has(d.documentId),
    );

    let enqueued = 0;
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (const doc of toEnqueue) {
      if (dryRun) {
        logger.info({ key: doc.key, documentId: doc.documentId }, '[Backfill] DRY RUN — would enqueue');
        enqueued++;
        continue;
      }

      if (this.options.rateLimitMs > 0) {
        await this.sleep(this.options.rateLimitMs);
      }

      enqueued++;
      try {
        const result = await this.service.createArchive({
          documentId: doc.documentId,
          userId: docMap.get(doc.documentId)!,
          force: false,
        });

        if (result.status === 'COMPLETED') {
          completed++;
          logger.info({ documentId: doc.documentId }, '[Backfill] Archive created');
        } else {
          failed++;
          logger.error(
            { documentId: doc.documentId, error: result.error?.message },
            '[Backfill] Conversion failed',
          );
        }
      } catch (err) {
        failed++;
        logger.error(
          { documentId: doc.documentId, err: err instanceof Error ? err.message : String(err) },
          '[Backfill] Job failed',
        );
      }
    }

    logger.info({ enqueued, completed, failed, skipped, total: listed.length }, '[Backfill] Run complete');
    archiveMetrics.logLifecycle('complete', { enqueued, completed, failed, skipped });

    return { enqueued, completed, failed, skipped, dryRun };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

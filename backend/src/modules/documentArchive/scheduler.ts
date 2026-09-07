import { archiveWorker } from './worker.js';
import { archiveSweeper } from './sweeper.js';
import { archiveMetrics } from './metrics.js';
import logger from '../../middleware/logger.js';

const WORKER_INTERVAL_SECONDS = Number(process.env.LOANFLOW_ARCHIVE_WORKER_INTERVAL_SEC ?? '30');
const SWEEPER_INTERVAL_SECONDS = Number(process.env.LOANFLOW_ARCHIVE_SWEEPER_INTERVAL_SEC ?? '3600');

let workerTimer: ReturnType<typeof setInterval> | null = null;
let sweeperTimer: ReturnType<typeof setInterval> | null = null;

export function startArchiveScheduler(): void {
  if (process.env.LOANFLOW_ARCHIVE_ENABLED === 'false') {
    logger.info('[ArchiveScheduler] Archive worker disabled via LOANFLOW_ARCHIVE_ENABLED=false');
    return;
  }

  logger.info(
    { workerInterval: WORKER_INTERVAL_SECONDS, sweeperInterval: SWEEPER_INTERVAL_SECONDS },
    '[ArchiveScheduler] Starting archive worker + sweeper',
  );

  workerTimer = setInterval(async () => {
    try {
      archiveMetrics.logLifecycle('start', { pending: archiveWorker.getQueueStatus().pending });
      await archiveWorker.process();
      archiveMetrics.logLifecycle('complete', { ...archiveWorker.getQueueStatus() });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, '[ArchiveScheduler] Worker tick failed');
    }
  }, WORKER_INTERVAL_SECONDS * 1000);

  workerTimer.unref();

  sweeperTimer = setInterval(async () => {
    try {
      const result = await archiveSweeper.sweepOrphans();
      logger.info({ deleted: result.deleted, errors: result.errors }, '[ArchiveScheduler] Sweeper tick');
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, '[ArchiveScheduler] Sweeper tick failed');
    }
  }, SWEEPER_INTERVAL_SECONDS * 1000);

  sweeperTimer.unref();
}

export function stopArchiveScheduler(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
  logger.info('[ArchiveScheduler] Stopped');
}

export interface ReconifierResult {
  requeued: number;
  errors: number;
}

export async function runArchiveReconciler(): Promise<ReconifierResult> {
  const { prisma } = await import('../../lib/prisma.js');

  const docs = await prisma.document.findMany({
    where: { status: { not: 'DELETED' } },
    select: { id: true, userId: true },
  });

  const archives = await prisma.documentArchive.findMany({
    where: { documentId: { in: docs.map((d) => d.id) } },
    select: { documentId: true, status: true },
  });

  const completedIds = new Set(archives.filter((a) => a.status === 'COMPLETED').map((a) => a.documentId));

  let requeued = 0;
  let errors = 0;

  for (const doc of docs) {
    if (!completedIds.has(doc.id)) {
      try {
        archiveWorker.enqueue(doc.id, doc.userId);
        requeued++;
      } catch {
        errors++;
      }
    }
  }

  logger.info({ requeued, errors }, '[ArchiveReconciler] Reconciler run complete');
  return { requeued, errors };
}

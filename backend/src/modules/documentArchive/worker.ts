import { ArchiveService } from './archive.service.js';
import logger from '../../middleware/logger.js';

export interface WorkerOptions {
  maxConcurrency: number;
  maxRetries: number;
  retryDelayMs: number;
  staleLeaseSeconds: number;
}

interface QueuedJob {
  documentId: string;
  userId: string;
  attempts: number;
  enqueuedAt: Date;
}

interface DeadLetterEntry {
  documentId: string;
  userId: string;
  attempts: number;
  lastError: string;
  deadLetteredAt: Date;
}

export class ArchiveWorker {
  private service: ArchiveService;
  private options: Required<WorkerOptions>;
  private queue: QueuedJob[] = [];
  private deadLetters: DeadLetterEntry[] = [];
  private readonly CONVERTER_VERSION = '1.0.0';

  constructor(service: ArchiveService, options?: Partial<WorkerOptions>) {
    this.service = service;
    this.options = {
      maxConcurrency: options?.maxConcurrency ?? 2,
      maxRetries: options?.maxRetries ?? 3,
      retryDelayMs: options?.retryDelayMs ?? 1000,
      staleLeaseSeconds: options?.staleLeaseSeconds ?? 300,
    };
  }

  enqueue(documentId: string, userId: string): void {
    // Idempotency: dedupe jobs for the same documentId (§18 C1)
    const existing = this.queue.find((j) => j.documentId === documentId);
    if (existing) return;
    this.queue.push({ documentId, userId, attempts: 0, enqueuedAt: new Date() });
  }

  async process(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.options.maxConcurrency);

    await Promise.all(
      batch.map(async (job) => {
        await this.runJobWithRetry(job);
      }),
    );
  }

  private async runJobWithRetry(job: QueuedJob): Promise<void> {
    while (true) {
      try {
        await this.service.createArchive({
          documentId: job.documentId,
          userId: job.userId,
          force: false,
        });
        return;
      } catch (err) {
        job.attempts++;
        const msg = err instanceof Error ? err.message : String(err);

        const isTransient = msg !== undefined && /S3 \d{3}|network|timeout|temporarily|ECONNREFUSED/i.test(msg);

        if (isTransient && job.attempts <= this.options.maxRetries) {
          const delay = this.options.retryDelayMs * Math.pow(2, job.attempts - 1);
          logger.info(
            { documentId: job.documentId, attempt: job.attempts, delay },
            '[ArchiveWorker] Transient failure, retrying',
          );
          await this.sleep(delay);
          continue;
        }

        if (job.attempts > this.options.maxRetries) {
          this.deadLetters.push({
            documentId: job.documentId,
            userId: job.userId,
            attempts: job.attempts,
            lastError: msg,
            deadLetteredAt: new Date(),
          });
          logger.error(
            { documentId: job.documentId, attempts: job.attempts, error: msg },
            '[ArchiveWorker] Moved to dead-letter after max retries (§18 C4)',
          );
          return;
        }

        logger.error(
          { documentId: job.documentId, attempt: job.attempts, error: msg },
          '[ArchiveWorker] Job failed',
        );
        return;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getQueueStatus(): { pending: number; processing: number; dead: number } {
    return {
      pending: this.queue.length,
      processing: 0,
      dead: this.deadLetters.length,
    };
  }

  getDeadLetters(): DeadLetterEntry[] {
    return [...this.deadLetters];
  }

  getVersion(): string {
    return this.CONVERTER_VERSION;
  }
}

export const archiveWorker = new ArchiveWorker(new ArchiveService());

import logger from '../../middleware/logger.js';

export interface WorkerMetrics {
  enqueued: number;
  completed: number;
  failed: number;
  deadLettered: number;
  retried: number;
  perStatus: Record<string, number>;
  perFormat: Record<string, number>;
}

export class MetricsCollector {
  private metrics: WorkerMetrics = {
    enqueued: 0,
    completed: 0,
    failed: 0,
    deadLettered: 0,
    retried: 0,
    perStatus: {},
    perFormat: {},
  };

  increment(key: 'enqueued' | 'completed' | 'failed' | 'deadLettered' | 'retried'): void {
    this.metrics[key]++;
  }

  incrementStatus(status: string): void {
    this.metrics.perStatus[status] = (this.metrics.perStatus[status] ?? 0) + 1;
  }

  incrementFormat(format: string): void {
    this.metrics.perFormat[format] = (this.metrics.perFormat[format] ?? 0) + 1;
  }

  get(): WorkerMetrics {
    return { ...this.metrics, perStatus: { ...this.metrics.perStatus }, perFormat: { ...this.metrics.perFormat } };
  }

  reset(): void {
    this.metrics = {
      enqueued: 0,
      completed: 0,
      failed: 0,
      deadLettered: 0,
      retried: 0,
      perStatus: {},
      perFormat: {},
    };
  }

  logLifecycle(stage: 'start' | 'complete', extra?: Record<string, unknown>): void {
    logger.info(
      { stage, ...extra, metrics: this.get() },
      '[ArchiveWorker] Lifecycle event',
    );
  }
}

export const archiveMetrics = new MetricsCollector();

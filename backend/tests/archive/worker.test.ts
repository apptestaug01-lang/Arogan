import { ArchiveWorker } from '../../src/modules/documentArchive/worker.js';
import { ArchiveService } from '../../src/modules/documentArchive/archive.service.js';
import { ArchiveConverterRegistry } from '../../src/modules/documentArchive/converters/index.js';

jest.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    documentArchive: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/storage.service.js', () => ({
  headObject: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
  createPresignedDownloadUrl: jest.fn(),
  deleteObject: jest.fn(),
}));

describe('ArchiveWorker', () => {
  let worker: ArchiveWorker;
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = require('../../src/lib/prisma.js').prisma;

    const registry = new ArchiveConverterRegistry([]);
    const service = new ArchiveService(registry);
    worker = new ArchiveWorker(service, { maxConcurrency: 2, maxRetries: 3, retryDelayMs: 10 });
  });

  describe('enqueue', () => {
    it('accepts a documentId job', () => {
      worker.enqueue('doc-1', 'user-1');
      const queue = worker.getQueueStatus();
      expect(queue.pending).toBe(1);
    });

    it('deduplicates jobs for the same documentId (§18 C1)', () => {
      worker.enqueue('doc-1', 'user-1');
      worker.enqueue('doc-1', 'user-1');
      const queue = worker.getQueueStatus();
      expect(queue.pending).toBe(1);
    });
  });

  describe('process', () => {
    it('claims PENDING job, processes, and marks COMPLETED', async () => {
      const serviceSpy = jest.spyOn(worker['service'], 'createArchive');
      serviceSpy.mockResolvedValue({ status: 'COMPLETED', archiveKey: '.loanflow/doc-1/document.json' });

      worker.enqueue('doc-1', 'user-1');
      await worker.process();

      expect(serviceSpy).toHaveBeenCalledWith({ documentId: 'doc-1', userId: 'user-1', force: false });
    });

    it('retries on transient failure with backoff (§18 C4)', async () => {
      const serviceSpy = jest.spyOn(worker['service'], 'createArchive');
      serviceSpy
        .mockRejectedValueOnce(new Error('S3 500'))
        .mockResolvedValueOnce({ status: 'COMPLETED', archiveKey: '.loanflow/doc-1/document.json' });

      worker.enqueue('doc-1', 'user-1');
      await worker.process();

      expect(serviceSpy).toHaveBeenCalledTimes(2);
    });

    it('moves to dead-letter after max retries (§18 C4)', async () => {
      const serviceSpy = jest.spyOn(worker['service'], 'createArchive');
      // Always throw a transient-looking error to exhaust retries
      serviceSpy.mockRejectedValue(new Error('S3 500 temporary error'));

      worker.enqueue('doc-1', 'user-1');
      await worker.process();

      expect(serviceSpy).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      const dead = worker.getDeadLetters();
      expect(dead).toContainEqual(expect.objectContaining({ documentId: 'doc-1' }));
    });
  });

  describe('getQueueStatus', () => {
    it('returns pending count', () => {
      worker.enqueue('doc-1', 'user-1');
      worker.enqueue('doc-2', 'user-1');
      const status = worker.getQueueStatus();
      expect(status.pending).toBe(2);
    });
  });
});

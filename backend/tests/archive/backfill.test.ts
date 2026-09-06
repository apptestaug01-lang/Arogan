import { BackfillRunner } from '../../src/modules/documentArchive/backfill.js';
import { ArchiveService } from '../../src/modules/documentArchive/archive.service.js';
import { ArchiveConverterRegistry } from '../../src/modules/documentArchive/converters/index.js';

jest.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
    },
    documentArchive: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/storage.service.js', () => ({
  listObjects: jest.fn(),
  headObject: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
  createPresignedDownloadUrl: jest.fn(),
  deleteObject: jest.fn(),
}));

import { prisma } from '../../src/lib/prisma.js';
import { listObjects } from '../../src/services/storage.service.js';

describe('BackfillRunner (C10)', () => {
  let service: ArchiveService;
  let runner: BackfillRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    const registry = new ArchiveConverterRegistry([]);
    service = new ArchiveService(registry);
    runner = new BackfillRunner(service, { concurrency: 1, pageSize: 10, rateLimitMs: 0 });
  });

  it('enqueues documents that lack a COMPLETED archive (F4)', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', userId: 'user-1' },
      { id: 'doc-2', userId: 'user-1' },
    ]);
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([
      { documentId: 'doc-1', status: 'COMPLETED' },
    ]);
    (listObjects as jest.Mock).mockResolvedValue([
      { key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', size: 1024 },
      { key: 'borrowers/user-1/applications/app-2/documents/doc-2/report.pdf', size: 2048 },
    ]);
    jest.spyOn(service, 'createArchive').mockResolvedValue({ status: 'COMPLETED', archiveKey: '.loanflow/doc-2/archive.tar.gz' });

    const result = await runner.runOnce();

    expect(service.createArchive).toHaveBeenCalledTimes(1);
    expect(service.createArchive).toHaveBeenCalledWith({
      documentId: 'doc-2',
      userId: 'user-1',
      force: false,
    });
    expect(result.enqueued).toBe(1);
    expect(result.completed).toBe(1);
  });

  it('skips documents already COMPLETED (idempotent, F4)', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', userId: 'user-1' },
    ]);
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([
      { documentId: 'doc-1', status: 'COMPLETED' },
    ]);
    (listObjects as jest.Mock).mockResolvedValue([
      { key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', size: 1024 },
    ]);
    jest.spyOn(service, 'createArchive').mockResolvedValue({ status: 'COMPLETED' });

    const result = await runner.runOnce();

    expect(service.createArchive).not.toHaveBeenCalled();
    expect(result.enqueued).toBe(0);
  });

  it('respects dryRun flag — no writes', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', userId: 'user-1' },
    ]);
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([]);
    (listObjects as jest.Mock).mockResolvedValue([
      { key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', size: 1024 },
    ]);
    jest.spyOn(service, 'createArchive').mockResolvedValue({ status: 'COMPLETED' });

    const result = await runner.runOnce({ dryRun: true });

    expect(service.createArchive).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.enqueued).toBe(1);
  });

  it('resumes across runs — skips docs COMPLETED by prior run (F4)', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', userId: 'user-1' },
      { id: 'doc-2', userId: 'user-1' },
    ]);
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([]);
    (listObjects as jest.Mock).mockResolvedValue([
      { key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', size: 1024 },
      { key: 'borrowers/user-1/applications/app-2/documents/doc-2/report.pdf', size: 2048 },
    ]);
    jest.spyOn(service, 'createArchive').mockResolvedValue({ status: 'COMPLETED' });

    const result1 = await runner.runOnce({});
    expect(result1.enqueued).toBe(2);
    expect(result1.completed).toBe(2);

    // Simulate first run's COMPLETED archive persisted to DB
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([
      { documentId: 'doc-1', status: 'COMPLETED' },
    ]);
    (service.createArchive as jest.Mock).mockClear();

    const result2 = await runner.runOnce({});
    expect(result2.enqueued).toBe(1);
    expect(service.createArchive).toHaveBeenCalledTimes(1);
    expect(service.createArchive).toHaveBeenCalledWith({
      documentId: 'doc-2',
      userId: 'user-1',
      force: false,
    });
  });

  it('returns correct counts on failure', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', userId: 'user-1' },
    ]);
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([]);
    (listObjects as jest.Mock).mockResolvedValue([
      { key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', size: 1024 },
    ]);
    jest.spyOn(service, 'createArchive').mockResolvedValue({
      status: 'FAILED',
      error: { code: 'CONVERSION_ERROR', message: 'bad file' },
    });

    const result = await runner.runOnce();

    expect(result.failed).toBe(1);
    expect(result.completed).toBe(0);
  });
});

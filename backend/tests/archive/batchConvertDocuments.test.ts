import { parseArgs, shouldSkipKey, listDocumentKeys } from '../../src/scripts/batchConvertDocuments';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../../src/config/storage.config';
import { createS3Client } from '../../src/services/storage.service';
import { ArchiveService } from '../../src/modules/documentArchive/archive.service';

jest.mock('../../src/config/storage.config', () => ({
  getStorageConfig: jest.fn().mockReturnValue({ bucket: 'test-bucket', region: 'us-east-1', endpoint: 'https://s3.test' }),
}));

jest.mock('../../src/services/storage.service', () => ({
  createS3Client: jest.fn(),
}));

jest.mock('../../src/modules/documentArchive/archive.service', () => ({
  ArchiveService: jest.fn(),
}));

describe('batchConvertDocuments C9 — repointed to ArchiveService', () => {
  const mockS3 = {
    send: jest.fn(),
  } as unknown as S3Client;

  beforeEach(() => {
    jest.clearAllMocks();
    (getStorageConfig as jest.Mock).mockReturnValue({ bucket: 'test-bucket', region: 'us-east-1', endpoint: 'https://s3.test' });
    (createS3Client as jest.Mock).mockReturnValue(mockS3);
  });

  function makeMockArchiveService(): ArchiveService {
    const svc = {
      createArchive: jest.fn().mockResolvedValue({ status: 'COMPLETED', archiveKey: '.loanflow/doc-1/archive.tar.gz' }),
    };
    (ArchiveService as unknown as jest.Mock).mockImplementation(() => svc);
    return svc as unknown as ArchiveService;
  }

  describe('parseArgs', () => {
    it('parses all CLI flags', () => {
      const args = parseArgs(['node', 'script', '--prefix', 'borrowers/u1/', '--force', '--dry-run', '--concurrency', '5', '--limit', '10']);
      expect(args.prefix).toBe('borrowers/u1/');
      expect(args.force).toBe(true);
      expect(args.dryRun).toBe(true);
      expect(args.concurrency).toBe(5);
      expect(args.limit).toBe(10);
    });

    it('defaults are correct', () => {
      const args = parseArgs(['node', 'script']);
      expect(args.force).toBe(false);
      expect(args.dryRun).toBe(false);
      expect(args.concurrency).toBe(3);
      expect(args.limit).toBeUndefined();
    });
  });

  describe('shouldSkipKey', () => {
    it('skips .loanflow/ keys (§18 F3)', () => {
      expect(shouldSkipKey('.loanflow/doc-1/archive.tar.gz')).toBe(true);
    });

    it('skips legacy .json siblings (§18 F3)', () => {
      expect(shouldSkipKey('borrowers/u1/report.json')).toBe(true);
    });

    it('skips DELETED document keys', () => {
      expect(shouldSkipKey('borrowers/u1/DELETED_doc.pdf')).toBe(true);
    });

    it('does not skip valid document keys', () => {
      expect(shouldSkipKey('borrowers/u1/applications/app-1/documents/doc-1/report.pdf')).toBe(false);
    });
  });

  describe('listDocumentKeys', () => {
    it('lists objects, filters out .loanflow/ and legacy .json', async () => {
      mockS3.send = jest.fn().mockResolvedValue({
        Contents: [
          { Key: 'borrowers/u1/report.pdf', Size: 1024 },
          { Key: 'borrowers/u1/.loanflow/doc-1/archive.tar.gz', Size: 512 },
          { Key: 'borrowers/u1/report.json', Size: 256 },
          { Key: 'borrowers/u1/DELETED_doc.pdf', Size: 0 },
        ],
        NextContinuationToken: undefined,
      });

      const result = await listDocumentKeys(mockS3, 'test-bucket', 'borrowers/u1/', undefined);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('borrowers/u1/report.pdf');
    });

    it('respects limit parameter', async () => {
      mockS3.send = jest.fn().mockResolvedValue({
        Contents: Array.from({ length: 15 }, (_, i) => ({ Key: `borrowers/u1/doc-${i}.pdf`, Size: 100 })),
        NextContinuationToken: undefined,
      });

      const result = await listDocumentKeys(mockS3, 'test-bucket', 'borrowers/u1/', 5);

      expect(result).toHaveLength(5);
    });
  });

  describe('dry-run behavior', () => {
    it('does not call ArchiveService.createArchive in dry-run mode', async () => {
      const mockArchiveService = makeMockArchiveService();
      mockS3.send = jest.fn().mockImplementation((cmd) => {
        if (cmd instanceof HeadObjectCommand) {
          return Promise.resolve({ ContentType: 'application/pdf', ContentLength: 1024 });
        }
        return Promise.resolve({
          Contents: [{ Key: 'borrowers/u1/report.pdf', Size: 1024 }],
          NextContinuationToken: undefined,
        });
      });

      const { runBatch } = await import('../../src/scripts/batchConvertDocuments');
      const result = await runBatch({
        prefix: 'borrowers/u1/',
        force: false,
        dryRun: true,
        concurrency: 1,
        limit: undefined,
      }, mockArchiveService);

      expect(mockArchiveService.createArchive).not.toHaveBeenCalled();
      expect(result.dryRun).toBe(true);
    });
  });

  describe('live mode enqueues through ArchiveService', () => {
    it('calls archiveService.createArchive with documentId and userId', async () => {
      const mockArchiveService = {
        createArchive: jest.fn().mockResolvedValue({ status: 'COMPLETED', archiveKey: '.loanflow/doc-1/archive.tar.gz' }),
      } as unknown as ArchiveService;

      mockS3.send = jest.fn().mockImplementation((cmd) => {
        if (cmd instanceof HeadObjectCommand) {
          return Promise.resolve({ ContentType: 'application/pdf', ContentLength: 1024, Metadata: { 'document-id': 'doc-1', 'user-id': 'user-1' } });
        }
        if (cmd instanceof ListObjectsV2Command) {
          return Promise.resolve({
            Contents: [{ Key: 'borrowers/u1/report.pdf', Size: 1024 }],
            NextContinuationToken: undefined,
          });
        }
        return Promise.resolve({});
      });

      const { runBatch } = await import('../../src/scripts/batchConvertDocuments');
      const result = await runBatch({
        prefix: 'borrowers/u1/',
        force: false,
        dryRun: false,
        concurrency: 1,
        limit: undefined,
      }, mockArchiveService);

      expect(mockArchiveService.createArchive).toHaveBeenCalledWith({
        documentId: 'doc-1',
        userId: 'user-1',
        force: false,
      });
      expect(result.completed).toBe(1);
    });
  });
});

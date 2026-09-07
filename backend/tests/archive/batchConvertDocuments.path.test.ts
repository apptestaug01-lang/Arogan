import { parseArgs, shouldSkipKey, listDocumentKeys, runBatch, BatchArgs } from '../../src/scripts/batchConvertDocuments';
import { BackfillRunner } from '../../src/modules/documentArchive/backfill.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

jest.mock('../../src/config/storage.config', () => ({
  getStorageConfig: jest.fn().mockReturnValue({ bucket: 'test-bucket', region: 'us-east-1', endpoint: 'https://s3.test' }),
}));

jest.mock('../../src/services/storage.service', () => ({
  createS3Client: jest.fn().mockReturnValue({ send: jest.fn() }),
  listObjects: jest.fn(),
  headObject: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
  createPresignedDownloadUrl: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('../../src/modules/documentArchive/backfill.js', () => ({
  BackfillRunner: jest.fn(),
}));

describe('batchConvertDocuments C12 — B4 path-based resolution', () => {
  const mockS3 = {
    send: jest.fn(),
  } as unknown as S3Client;

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  describe('shouldSkipKey — F3 scoping', () => {
    it('skips .loanflow/ at any path depth', () => {
      expect(shouldSkipKey('.loanflow/doc-1/archive.tar.gz')).toBe(true);
      expect(shouldSkipKey('borrowers/u1/.loanflow/doc-1/archive.tar.gz')).toBe(true);
    });

    it('skips legacy .json siblings', () => {
      expect(shouldSkipKey('borrowers/u1/report.json')).toBe(true);
    });

    it('skips DELETED_ prefix', () => {
      expect(shouldSkipKey('borrowers/u1/DELETED_doc.pdf')).toBe(true);
    });

    it('does not skip valid document keys', () => {
      expect(shouldSkipKey('borrowers/user-1/applications/app-1/documents/doc-1/report.pdf')).toBe(false);
    });
  });

  describe('listDocumentKeys — path-based candidate extraction', () => {
    it('filters out .loanflow/, .json, DELETED_ but keeps valid docs', async () => {
      mockS3.send = jest.fn().mockResolvedValue({
        Contents: [
          { Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', Size: 1024 },
          { Key: 'borrowers/user-1/.loanflow/doc-1/archive.tar.gz', Size: 512 },
          { Key: 'borrowers/user-1/report.json', Size: 256 },
          { Key: 'borrowers/user-1/DELETED_old.pdf', Size: 0 },
        ],
        NextContinuationToken: undefined,
      });

      const keys = await listDocumentKeys(mockS3, 'test-bucket', 'borrowers/', undefined);

      expect(keys).toHaveLength(1);
      expect(keys[0].key).toBe('borrowers/user-1/applications/app-1/documents/doc-1/report.pdf');
    });

    it('never sends ListObjectsV2Command with .loanflow/ as prefix', async () => {
      mockS3.send = jest.fn().mockResolvedValue({ Contents: [], NextContinuationToken: undefined });

      await listDocumentKeys(mockS3, 'test-bucket', 'borrowers/', undefined);

      const cmd = (mockS3.send as jest.Mock).mock.calls[0][0];
      expect(cmd).toBeInstanceOf(ListObjectsV2Command);
      expect(cmd.input.Prefix).toBe('borrowers/');
    });
  });

  describe('runBatch delegates to BackfillRunner (B4)', () => {
    it('delegates to BackfillRunner.runOnce in live mode', async () => {
      const mockRunner = {
        runOnce: jest.fn().mockResolvedValue({
          enqueued: 1,
          completed: 1,
          failed: 0,
          skipped: 0,
          dryRun: false,
        }),
      };
      (BackfillRunner as unknown as jest.Mock).mockImplementation(() => mockRunner);

      const args: BatchArgs = {
        prefix: 'borrowers/',
        force: false,
        dryRun: false,
        concurrency: 1,
        limit: undefined,
      };

      const result = await runBatch(args, {} as any);

      expect(mockRunner.runOnce).toHaveBeenCalledWith({ dryRun: false });
      expect(result.completed).toBe(1);
    });

    it('passes dryRun=true to BackfillRunner in dry-run mode', async () => {
      const mockRunner = {
        runOnce: jest.fn().mockResolvedValue({
          enqueued: 5,
          completed: 0,
          failed: 0,
          skipped: 0,
          dryRun: true,
        }),
      };
      (BackfillRunner as unknown as jest.Mock).mockImplementation(() => mockRunner);

      const args: BatchArgs = {
        prefix: 'borrowers/',
        force: false,
        dryRun: true,
        concurrency: 1,
        limit: undefined,
      };

      const result = await runBatch(args, {} as any);

      expect(mockRunner.runOnce).toHaveBeenCalledWith({ dryRun: true });
      expect(result.dryRun).toBe(true);
      expect(result.completed).toBe(0);
    });
  });
});

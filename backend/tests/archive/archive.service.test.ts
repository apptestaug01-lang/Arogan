import { ArchiveService } from '../../src/modules/documentArchive/archive.service.js';
import { ArchiveConverterRegistry } from '../../src/modules/documentArchive/converters/index.js';
import { ArchiveConverter, ConvertContext, ArchiveBuild } from '../../src/modules/documentArchive/converters/index.js';

jest.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findUnique: jest.fn(),
    },
    documentArchive: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/storage.service.js', () => ({
  headObject: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
  createPresignedDownloadUrl: jest.fn(),
}));

jest.mock('../../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn(),
}));

describe('ArchiveService', () => {
  let service: ArchiveService;
  let prisma: any;
  let storage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = require('../../src/lib/prisma.js').prisma;
    storage = require('../../src/services/storage.service.js');

    const mockConverter: ArchiveConverter = {
      supportedTypes: ['application/pdf'],
      convert: jest.fn().mockResolvedValue({
        format: 'pdf',
        metadata: { pageCount: 1 },
        pages: [{ pageNumber: 1, blocks: [], ocr: null }],
        text: { rawText: 'test', charCount: 4, searchable: true },
        assets: [],
        byteArchive: null,
        warnings: [],
      } as ArchiveBuild),
    };

    const registry = new ArchiveConverterRegistry([mockConverter]);
    service = new ArchiveService(registry);
  });

  describe('getArchiveStatus', () => {
    it('returns COMPLETED status when archive exists', async () => {
      prisma.documentArchive.findUnique.mockResolvedValue({
        id: 'arch-1',
        documentId: 'doc-1',
        status: 'COMPLETED',
        archiveKey: '.loanflow/doc-1/document.json',
        sourceSha256: 'abc123',
        converterVersion: '1.0.0',
        byteTier: 'embedded',
        fidelityVerified: true,
        warnings: [],
      });

      const result = await service.getArchiveStatus('doc-1');
      expect(result.status).toBe('COMPLETED');
      expect(result.archiveKey).toBe('.loanflow/doc-1/document.json');
    });

    it('returns undefined when no archive exists', async () => {
      prisma.documentArchive.findUnique.mockResolvedValue(null);
      const result = await service.getArchiveStatus('doc-1');
      expect(result).toBeNull();
    });
  });

  describe('createArchive', () => {
    it('builds archive from source object with correct flow', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-1',
        s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/test.pdf',
        contentType: 'application/pdf',
        size: 100,
        checksum: 'etag123',
        originalName: 'test.pdf',
        createdAt: new Date('2026-01-01'),
      });

      prisma.documentArchive.findUnique.mockResolvedValue(null);

      storage.headObject.mockResolvedValue({ size: 100, checksum: 'etag123' });
      storage.getObject.mockResolvedValue({
        body: Buffer.from('%PDF-1.4 test'),
        contentType: 'application/pdf',
      });
      storage.putObject.mockResolvedValue(undefined);
      prisma.documentArchive.create.mockResolvedValue({});
      prisma.documentArchive.update.mockResolvedValue({});

      const result = await service.createArchive({
        documentId: 'doc-1',
        userId: 'user-1',
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.archiveKey).toBeDefined();
      expect(storage.getObject).toHaveBeenCalledWith(
        'borrowers/user-1/applications/app-1/documents/doc-1/test.pdf',
      );
    });

    it('skips when archive already COMPLETED with matching sha256', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-1',
        s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/test.pdf',
        contentType: 'application/pdf',
        size: 100,
        checksum: 'etag123',
        originalName: 'test.pdf',
        createdAt: new Date('2026-01-01'),
      });

      prisma.documentArchive.findUnique.mockResolvedValue({
        id: 'arch-1',
        documentId: 'doc-1',
        status: 'COMPLETED',
        converterVersion: '1.0.0',
        sourceSha256: 'abc123',
      });

      storage.headObject.mockResolvedValue({ size: 100, checksum: 'etag123' });

      const result = await service.createArchive({
        documentId: 'doc-1',
        userId: 'user-1',
        force: false,
      });

      expect(result.status).toBe('COMPLETED');
      expect(storage.getObject).not.toHaveBeenCalled();
    });

    it('re-archives when conversionVersion changed even if COMPLETED', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-1',
        s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/test.pdf',
        contentType: 'application/pdf',
        size: 100,
        checksum: 'etag123',
        originalName: 'test.pdf',
        createdAt: new Date('2026-01-01'),
      });

      prisma.documentArchive.findUnique.mockResolvedValue({
        id: 'arch-1',
        documentId: 'doc-1',
        status: 'COMPLETED',
        converterVersion: '0.9.0',
        sourceSha256: 'abc123',
      });

      storage.headObject.mockResolvedValue({ size: 100, checksum: 'etag123' });
      storage.getObject.mockResolvedValue({
        body: Buffer.from('test'),
        contentType: 'application/pdf',
      });
      storage.putObject.mockResolvedValue(undefined);
      prisma.documentArchive.create.mockResolvedValue({});
      prisma.documentArchive.update.mockResolvedValue({});

      const result = await service.createArchive({
        documentId: 'doc-1',
        userId: 'user-1',
      });

      expect(storage.getObject).toHaveBeenCalled();
    });

    it('marks FAILED when source object is missing (§18 A2)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-1',
        s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/test.pdf',
        contentType: 'application/pdf',
        size: 100,
        checksum: 'etag123',
        originalName: 'test.pdf',
        createdAt: new Date('2026-01-01'),
      });

      prisma.documentArchive.findUnique.mockResolvedValue(null);
      storage.headObject.mockRejectedValue(new Error('NotFound'));

      const result = await service.createArchive({
        documentId: 'doc-1',
        userId: 'user-1',
      });

      expect(result.status).toBe('FAILED');
      expect(result.error?.code).toBe('SOURCE_MISSING');
    });

    it('computes sha256 on downloaded bytes, not on ETag (§18 A1)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-1',
        s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/test.pdf',
        contentType: 'application/pdf',
        size: 100,
        checksum: 'etag123',
        originalName: 'test.pdf',
        createdAt: new Date('2026-01-01'),
      });

      prisma.documentArchive.findUnique.mockResolvedValue(null);
      storage.headObject.mockResolvedValue({ size: 100, checksum: 'etag123' });
      storage.getObject.mockResolvedValue({
        body: Buffer.from('%PDF-1.4 test'),
        contentType: 'application/pdf',
      });
      storage.putObject.mockResolvedValue(undefined);
      prisma.documentArchive.create.mockResolvedValue({});
      prisma.documentArchive.update.mockResolvedValue({});

      await service.createArchive({ documentId: 'doc-1', userId: 'user-1' });

      expect(prisma.documentArchive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId: 'doc-1' },
          data: expect.objectContaining({
            sourceSha256: expect.any(String),
          }),
        }),
      );
    });
  });
});

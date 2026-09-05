import { ArchiveSweeper } from '../../src/modules/documentArchive/sweeper.js';
import { prisma } from '../../lib/prisma.js';
import { LOANFLOW_DERIVED_PREFIX } from '../../utils/constants.js';

jest.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/storage.service.js', () => ({
  deleteObject: jest.fn(),
  listObjects: jest.fn(),
}));

describe('ArchiveSweeper', () => {
  let sweeper: ArchiveSweeper;
  let prisma: any;
  let storage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = require('../../src/lib/prisma.js').prisma;
    storage = require('../../src/services/storage.service.js');
    sweeper = new ArchiveSweeper({ staleThresholdMinutes: 60 });
  });

  describe('sweepOrphans', () => {
    it('removes .loanflow assets for DELETED documents (§18 D1)', async () => {
      // findMany with { status: { not: 'DELETED' } } — mock returns only active docs
      prisma.document.findMany.mockResolvedValue([]);
      storage.listObjects.mockResolvedValue([
        { key: '.loanflow/doc-deleted/assets/page-0001.png', size: 1000 },
        { key: '.loanflow/doc-deleted/document.json', size: 500 },
      ]);
      storage.deleteObject.mockResolvedValue(undefined);

      await sweeper.sweepOrphans();

      expect(storage.deleteObject).toHaveBeenCalledTimes(2);
      expect(storage.deleteObject).toHaveBeenCalledWith('.loanflow/doc-deleted/assets/page-0001.png');
      expect(storage.deleteObject).toHaveBeenCalledWith('.loanflow/doc-deleted/document.json');
    });

    it('preserves assets for active documents', async () => {
      prisma.document.findMany.mockResolvedValue([
        { id: 'doc-active', status: 'UPLOADED', s3Key: 'borrowers/u/apps/a/documents/doc-active/file.pdf' },
      ]);
      storage.listObjects.mockResolvedValue([
        { key: '.loanflow/doc-active/document.json', size: 500 },
      ]);

      await sweeper.sweepOrphans();

      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('removes orphaned .loanflow assets without a matching document row', async () => {
      prisma.document.findMany.mockResolvedValue([
        { id: 'doc-active', status: 'UPLOADED', s3Key: 'borrowers/u/apps/a/documents/doc-active/file.pdf' },
      ]);
      storage.listObjects.mockResolvedValue([
        { key: '.loanflow/orphan-doc/assets/page.png', size: 100 },
        { key: '.loanflow/doc-active/document.json', size: 500 },
      ]);

      await sweeper.sweepOrphans();

      expect(storage.deleteObject).toHaveBeenCalledWith('.loanflow/orphan-doc/assets/page.png');
      expect(storage.deleteObject).not.toHaveBeenCalledWith('.loanflow/doc-active/document.json');
    });
  });
});

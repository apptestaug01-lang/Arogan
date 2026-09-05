import { listExplorer } from '../../src/services/explorer.service.js';

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({});
  class S3Client {
    send = send;
    constructor() {}
  }
  const makeCmd = () =>
    class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    };
  return {
    S3Client,
    HeadObjectCommand: makeCmd(),
    ListObjectsV2Command: makeCmd(),
  };
});

jest.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    documentArchive: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '../../src/lib/prisma.js';

function setupSend(result: any) {
  ;(new S3Client() as any).send.mockReset();
  ;(new S3Client() as any).send.mockImplementation((cmd: any) => {
    if (cmd instanceof ListObjectsV2Command) return Promise.resolve(result);
    return Promise.resolve({});
  });
}

describe('listExplorer C7 — namespace isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', status: 'UPLOADED' },
    ]);
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('hides .loanflow/ objects at bucket root (§18 D2)', async () => {
    setupSend({
      CommonPrefixes: [{ Prefix: '.loanflow/' }, { Prefix: 'borrowers/user-1/applications/' }],
      Contents: [],
    });

    const res = await listExplorer({ userId: 'user-1' });

    expect(res.folders).toEqual([
      { name: 'applications', type: 'folder', key: 'borrowers/user-1/applications/' },
    ]);
  });

  it('shows hasArchive flag for documents with completed archives', async () => {
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([
      { documentId: 'doc-1', status: 'COMPLETED' },
    ]);
    setupSend({
      CommonPrefixes: [],
      Contents: [
        { Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', Size: 2048, LastModified: new Date('2026-08-20T10:00:00Z') },
      ],
    });

    const res = await listExplorer({ userId: 'user-1' });

    expect(res.files[0].documentId).toBe('doc-1');
    expect(res.files[0].hasArchive).toBe(true);
  });

  it('does not set hasArchive for documents without archives', async () => {
    (prisma.documentArchive.findMany as jest.Mock).mockResolvedValue([]);
    setupSend({
      CommonPrefixes: [],
      Contents: [
        { Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', Size: 2048, LastModified: new Date('2026-08-20T10:00:00Z') },
      ],
    });

    const res = await listExplorer({ userId: 'user-1' });
    expect(res.files[0].hasArchive).toBe(false);
  });

  it('filters .loanflow/ from Contents when listing inside borrower root', async () => {
    setupSend({
      CommonPrefixes: [],
      Contents: [
        { Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', Size: 2048, LastModified: new Date('2026-08-20T10:00:00Z') },
      ],
    });

    const res = await listExplorer({ userId: 'user-1' });
    const loanflowKeys = res.files.filter((f) => f.key.startsWith('.loanflow/'));
    expect(loanflowKeys).toHaveLength(0);
  });
});

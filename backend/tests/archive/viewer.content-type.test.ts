import { getKeyView, getDocumentView } from '../../src/services/viewer.service.js';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.view.url'),
}));

jest.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    document: { findUnique: jest.fn() },
  },
}));

jest.mock('../../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/storage.service.js', () => ({
  headObject: jest.fn(),
  createPresignedDownloadUrl: jest.fn().mockResolvedValue('https://signed.view.url'),
}));

import { prisma } from '../../src/lib/prisma.js';
import { headObject } from '../../src/services/storage.service.js';

const DOC = {
  id: 'doc-1',
  userId: 'user-1',
  s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf',
  originalName: 'report.pdf',
  contentType: 'application/pdf',
  size: 2048,
  status: 'UPLOADED',
};

describe('getKeyView content-type fix (§18 E4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the real content-type from headObject, not hardcoded json', async () => {
    (headObject as jest.Mock).mockResolvedValue({ size: 2048, checksum: 'etag123', contentType: 'application/pdf' });

    const result = await getKeyView({
      userId: 'user-1',
      key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf',
    });

    expect(result.contentType).toBe('application/pdf');
  });

  it('returns application/json when headObject says so', async () => {
    (headObject as jest.Mock).mockResolvedValue({ size: 100, checksum: 'etag', contentType: 'application/json' });

    const result = await getKeyView({
      userId: 'user-1',
      key: 'borrowers/user-1/applications/app-1/documents/doc-1/archive.json',
    });

    expect(result.contentType).toBe('application/json');
  });

  it('rejects keys outside the borrower root (403)', async () => {
    await expect(
      getKeyView({ userId: 'user-1', key: 'borrowers/user-2/docs/file.pdf' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('getDocumentView ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(DOC);
  });

  it('returns 404 for missing document', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(getDocumentView({ userId: 'user-1', documentId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns 403 for cross-user access', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({ ...DOC, userId: 'user-2' });
    await expect(getDocumentView({ userId: 'user-1', documentId: 'doc-1' })).rejects.toMatchObject({ statusCode: 403 });
  });
});

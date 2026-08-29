jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({});
  class S3Client {
    send = send;
    constructor() {}
  }
  return {
    S3Client,
    PutObjectCommand: class {
      input: unknown
      constructor(input: unknown) {
        this.input = input
      }
    },
    HeadObjectCommand: class {},
    HeadBucketCommand: class {},
    CreateBucketCommand: class {},
    PutPublicAccessBlockCommand: class {},
    PutBucketCorsCommand: class {},
    DeleteObjectCommand: class {},
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.url'),
}));

jest.mock('../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../src/lib/prisma.js';
import { logAuditEvent } from '../src/services/audit.service.js';
import { presignDocument, completeDocument, deleteDocument, listUserDocuments, bulkDeleteDocuments } from '../src/services/document.service.js';
import { buildDocumentKey } from '../src/utils/documentKey.js';

const PRESIGN_INPUT = {
  userId: 'user-1',
  applicationId: 'app-1',
  fileName: 'aadhar.pdf',
  contentType: 'application/pdf',
  contentLength: 1024,
};

beforeEach(() => {
  // resetMocks clears factory implementations; re-establish them per test.
  (getSignedUrl as jest.Mock).mockResolvedValue('https://signed.url');
  (prisma.document.create as jest.Mock).mockResolvedValue({ id: 'doc-1' });
  (logAuditEvent as jest.Mock).mockResolvedValue(undefined);
});

describe('presignDocument', () => {
  it('issues a presigned PUT url bound to the server-built key and TTL', async () => {
    const result = await presignDocument(PRESIGN_INPUT);

    expect(result.uploadUrl).toBe('https://signed.url');
    expect(result.expiresIn).toBe(900);
    expect(result.documentId).toEqual(expect.any(String));

    const expectedKey = buildDocumentKey('user-1', 'app-1', result.documentId, 'aadhar.pdf');
    expect(result.key).toBe(expectedKey);

    const [client, command, options] = (getSignedUrl as jest.Mock).mock.calls[0];
    expect(client).toBeInstanceOf(S3Client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Key).toBe(expectedKey);
    expect(command.input.ContentType).toBe('application/pdf');
    expect(command.input.ContentLength).toBe(1024);
    expect(options.expiresIn).toBe(900);

    expect(logAuditEvent).toHaveBeenCalledWith(
      'DOCUMENT_PRESIGN',
      undefined,
      undefined,
      'user-1',
      expect.objectContaining({ key: expectedKey }),
    );
  });

  it('rejects unsupported content types', async () => {
    await expect(
      presignDocument({ ...PRESIGN_INPUT, contentType: 'text/plain' }),
    ).rejects.toThrow('Unsupported file type. Supported formats: PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX');
  });

  it('rejects invalid file sizes', async () => {
    await expect(presignDocument({ ...PRESIGN_INPUT, contentLength: 0 })).rejects.toThrow(
      'Invalid file size',
    );
    await expect(
      presignDocument({ ...PRESIGN_INPUT, contentLength: 6 * 1024 * 1024 * 1024 }),
    ).rejects.toThrow('File size exceeds the 5 GB limit');
  });
});

describe('completeDocument', () => {
  it('records the document using storage metadata and marks it UPLOADED', async () => {
    const client = new S3Client();
    client.send.mockImplementation((cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        return Promise.resolve({ ContentLength: 2048, ETag: '"abc123"' });
      }
      return Promise.resolve({});
    });

    const result = await completeDocument({
      userId: 'user-1',
      documentId: 'doc-1',
      applicationId: 'app-1',
      fileName: 'aadhar.pdf',
      contentType: 'application/pdf',
    });

    const expectedKey = buildDocumentKey('user-1', 'app-1', 'doc-1', 'aadhar.pdf');
    expect(result.id).toBe('doc-1');
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        id: 'doc-1',
        userId: 'user-1',
        applicationId: 'app-1',
        category: 'Documents',
        s3Key: expectedKey,
        originalName: 'aadhar.pdf',
        contentType: 'application/pdf',
        size: 2048,
        checksum: 'abc123',
        status: 'UPLOADED',
      },
    });
    expect(logAuditEvent).toHaveBeenCalledWith(
      'DOCUMENT_UPLOADED',
      undefined,
      undefined,
      'user-1',
      expect.objectContaining({ documentId: 'doc-1' }),
    );
  });

  it('fails when the uploaded object is missing from storage', async () => {
    const client = new S3Client();
    client.send.mockImplementation((cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        return Promise.reject(new Error('NotFound'));
      }
      return Promise.resolve({});
    });

    await expect(
      completeDocument({
        userId: 'user-1',
        documentId: 'doc-1',
        applicationId: 'app-1',
        fileName: 'aadhar.pdf',
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow('Uploaded file not found in storage. The upload may have expired or failed.');
  });

  it('rejects duplicate filenames for the same user and application', async () => {
    (prisma.document.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-existing',
      originalName: 'aadhar.pdf',
    });

    const client = new S3Client();
    client.send.mockImplementation((cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        return Promise.resolve({ ContentLength: 2048, ETag: '"abc123"' });
      }
      return Promise.resolve({});
    });

    await expect(
      completeDocument({
        userId: 'user-1',
        documentId: 'doc-new',
        applicationId: 'app-1',
        fileName: 'aadhar.pdf',
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow('A document with this name already exists. Please rename the file and try again.');
  });
});

describe('listUserDocuments', () => {
  it('returns active documents for the caller, excluding deleted ones', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', applicationId: 'app-1', originalName: 'a.pdf', contentType: 'application/pdf', size: 1024, status: 'UPLOADED', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const result = await listUserDocuments({ userId: 'user-1' });

    expect(result).toHaveLength(1);
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', status: { not: 'DELETED' } },
        orderBy: [{ createdAt: 'desc' }],
      }),
    );
  });

  it('filters by category when provided', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    await listUserDocuments({ userId: 'user-1', category: 'KYC' });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', status: { not: 'DELETED' }, category: 'KYC' } }),
    );
  });
});

describe('bulkDeleteDocuments', () => {
  const OWNED = { id: 'doc-1', userId: 'user-1', s3Key: 'borrowers/user-1/app-1/documents/KYC/doc-1/a.pdf', status: 'UPLOADED' };

  beforeEach(() => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([OWNED]);
    (prisma.document.update as jest.Mock).mockResolvedValue({ id: 'doc-1', status: 'DELETED' });
    (new S3Client() as any).send.mockImplementation(() => Promise.resolve({}));
  });

  it('soft-deletes each owned document and removes the S3 object', async () => {
    const result = await bulkDeleteDocuments({ userId: 'user-1', documentIds: ['doc-1'] });
    expect(result.deleted).toBe(1);
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'DELETED' },
    });
    expect((new S3Client() as any).send).toHaveBeenCalled();
  });

  it('returns early when no ids are supplied', async () => {
    const result = await bulkDeleteDocuments({ userId: 'user-1', documentIds: [] });
    expect(result.deleted).toBe(0);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});

describe('deleteDocument', () => {
  const OWNER_DOC = { id: 'doc-1', userId: 'user-1', s3Key: 'borrowers/user-1/app-1/documents/doc-1/a.pdf', status: 'UPLOADED' };

  beforeEach(() => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(OWNER_DOC);
    (prisma.document.update as jest.Mock).mockResolvedValue({ id: 'doc-1', status: 'DELETED' });
    (new S3Client() as any).send.mockImplementation(() => Promise.resolve({}));
  });

  it('soft-deletes the document and deletes the S3 object', async () => {
    const result = await deleteDocument({ userId: 'user-1', documentId: 'doc-1' });

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'DELETED' },
    });
    expect((new S3Client() as any).send).toHaveBeenCalled();
    expect(result).toEqual({ id: 'doc-1', status: 'DELETED' });
  });

  it('rejects when the document does not exist', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      deleteDocument({ userId: 'user-1', documentId: 'nope' }),
    ).rejects.toThrow('Document not found');
  });

  it('rejects with 403 when the caller does not own the document', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: 'doc-1', userId: 'other-user', s3Key: 'key', status: 'UPLOADED',
    });
    await expect(
      deleteDocument({ userId: 'user-1', documentId: 'doc-1' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns 409 when the document is already deleted', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: 'doc-1', userId: 'user-1', s3Key: 'key', status: 'DELETED',
    });
    await expect(
      deleteDocument({ userId: 'user-1', documentId: 'doc-1' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

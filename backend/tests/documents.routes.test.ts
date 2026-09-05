let authed = true;

jest.mock('../src/middleware/authMiddleware.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    if (authed) {
      req.user = { id: 'user-1', email: 'a@b.co', role: 'BORROWER' };
    }
    next();
  },
  requireAuth: (req: any, _res: any, next: any) => {
    if (!req.user) {
      next({ statusCode: 401, message: 'Authentication required', isOperational: true });
      return;
    }
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

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
    documentExtraction: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

jest.mock('../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import { S3Client } from '@aws-sdk/client-s3';
import express from 'express';
import request from 'supertest';
import { documentsRouter } from '../src/routes/documents.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../src/lib/prisma.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/documents', documentsRouter);
  app.use(errorHandler);
  return app;
}

describe('documents routes', () => {
  beforeEach(() => {
    authed = true;
    // resetMocks clears factory implementations; re-establish per test.
    (getSignedUrl as jest.Mock).mockResolvedValue('https://signed.url');
    (prisma.document.create as jest.Mock).mockResolvedValue({ id: 'doc-1' });
    (prisma.documentExtraction.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    // headObject uses s3.send — give it a default resolution.
    new S3Client().send.mockResolvedValue({});
  });

  it('rejects unauthenticated requests with 401', async () => {
    authed = false;
    const res = await request(makeApp())
      .post('/api/documents/presign')
      .send({
        applicationId: 'app-1',
        category: 'KYC',
        fileName: 'a.pdf',
        contentType: 'application/pdf',
        contentLength: 1024,
      });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns a presigned url scoped to the authenticated user', async () => {
    const res = await request(makeApp())
      .post('/api/documents/presign')
      .send({
        applicationId: 'app-1',
        category: 'KYC',
        fileName: 'a.pdf',
        contentType: 'application/pdf',
        contentLength: 1024,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.uploadUrl).toBe('https://signed.url');
    expect(res.body.data.key).toContain('borrowers/user-1/');
    expect((getSignedUrl as jest.Mock).mock.calls[0][1].input.Key).toContain('borrowers/user-1/');
  });

  it('rejects an invalid presign body with 400', async () => {
    const res = await request(makeApp())
      .post('/api/documents/presign')
      .send({ category: 'KYC', fileName: 'a.pdf' });
    expect(res.status).toBe(400);
  });

  it('records a document on complete', async () => {
    const res = await request(makeApp())
      .post('/api/documents/doc-1/complete')
      .send({
        applicationId: 'app-1',
        category: 'KYC',
        fileName: 'a.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.document.id).toBe('doc-1');
    expect((prisma.document.create as jest.Mock).mock.calls[0][0].data.userId).toBe('user-1');
  });

  it('deletes a document owned by the caller', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: 'doc-1', userId: 'user-1', s3Key: 'some-key', status: 'UPLOADED',
    });
    (prisma.document.update as jest.Mock).mockResolvedValue({
      id: 'doc-1', status: 'DELETED',
    });

    const res = await request(makeApp()).delete('/api/documents/doc-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'DELETED' },
    });
  });

  it('returns 404 when deleting a non-existent document', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(makeApp()).delete('/api/documents/nope');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when deleting another user\'s document', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: 'doc-1', userId: 'other-user', s3Key: 'some-key', status: 'UPLOADED',
    });

    const res = await request(makeApp()).delete('/api/documents/doc-1');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('lists the caller\'s active documents', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', applicationId: 'app-1', category: 'KYC', originalName: 'a.pdf', contentType: 'application/pdf', size: 1024, status: 'UPLOADED', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await request(makeApp()).get('/api/documents/documents');

    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.documents[0].category).toBe('KYC');
  });

  it('bulk-deletes documents owned by the caller', async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', userId: 'user-1', s3Key: 'some-key', status: 'UPLOADED' },
    ]);
    (prisma.document.update as jest.Mock).mockResolvedValue({ id: 'doc-1', status: 'DELETED' });
    new S3Client().send.mockResolvedValue({});

    const res = await request(makeApp()).delete('/api/documents').send({ documentIds: ['doc-1'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'DELETED' },
    });
  });

  it('rejects a bulk delete with an empty id list', async () => {
    const res = await request(makeApp()).delete('/api/documents').send({ documentIds: [] });
    expect(res.status).toBe(400);
  });
});

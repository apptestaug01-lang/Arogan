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
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.url'),
}));

jest.mock('../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
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
});

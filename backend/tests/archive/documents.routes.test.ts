let authed = true;

jest.mock('../../src/middleware/authMiddleware.js', () => ({
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
    GetObjectCommand: class { input: unknown; constructor(input: unknown) { this.input = input; } },
    HeadObjectCommand: class { input: unknown; constructor(input: unknown) { this.input = input; } },
    PutObjectCommand: class { input: unknown; constructor(input: unknown) { this.input = input; } },
    ListObjectsV2Command: class { input: unknown; constructor(input: unknown) { this.input = input; } },
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.archive.url'),
}));

jest.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findUnique: jest.fn(),
    },
    documentArchive: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/storage.service.js', () => ({
  headObject: jest.fn(),
  createPresignedDownloadUrl: jest.fn().mockResolvedValue('https://signed.archive.url'),
  getObject: jest.fn(),
  putObject: jest.fn(),
}));

import { prisma } from '../../src/lib/prisma.js';
import express from 'express';
import request from 'supertest';
import { documentsRouter } from '../../src/routes/documents.routes.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

const DOC = {
  id: 'doc-1',
  userId: 'user-1',
  applicationId: 'app-1',
  s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf',
  originalName: 'report.pdf',
  contentType: 'application/pdf',
  size: 2048,
  status: 'UPLOADED',
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/documents', documentsRouter);
  app.use(errorHandler);
  return app;
}

describe('archive API routes (C6)', () => {
  beforeEach(() => {
    authed = true;
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(DOC);
    (prisma.documentArchive.findUnique as jest.Mock).mockResolvedValue(null);
    (require('../../src/services/storage.service.js').createPresignedDownloadUrl as jest.Mock)
      .mockResolvedValue('https://signed.archive.url');
    (require('../../src/services/storage.service.js').headObject as jest.Mock)
      .mockResolvedValue({ size: 2048, checksum: 'etag', contentType: 'application/octet-stream' });
  });

  it('GET /:documentId/archive-summary returns 200 with status', async () => {
    (prisma.documentArchive.findUnique as jest.Mock).mockResolvedValue({
      documentId: 'doc-1',
      status: 'COMPLETED',
      archiveKey: '.loanflow/doc-1/document.json',
      sourceSha256: 'abc123',
      byteTier: 'embedded',
      converterVersion: '1.0.0',
      fidelityVerified: true,
      warnings: [],
    });

    const res = await request(makeApp()).get('/api/documents/doc-1/archive-summary');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.archiveKey).toBe('.loanflow/doc-1/document.json');
  });

  it('GET /:documentId/archive-summary returns 403 for cross-user', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({ ...DOC, userId: 'user-2' });

    const res = await request(makeApp()).get('/api/documents/doc-1/archive-summary');
    expect(res.status).toBe(403);
  });

  it('GET /:documentId/archive-summary returns 404 for missing document', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/documents/missing/archive-summary');
    expect(res.status).toBe(404);
  });

  it('GET /:documentId/archive-view returns presigned URL (§18 E2, F5)', async () => {
    (prisma.documentArchive.findUnique as jest.Mock).mockResolvedValue({
      documentId: 'doc-1',
      status: 'COMPLETED',
      archiveKey: '.loanflow/doc-1/document.json',
    });

    const res = await request(makeApp()).get('/api/documents/doc-1/archive-view');
    expect(res.status).toBe(200);
    expect(res.body.data.viewUrl).toBe('https://signed.archive.url');
  });

  it('GET /:documentId/archive-view returns 404 when no COMPLETED archive', async () => {
    (prisma.documentArchive.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/documents/doc-1/archive-view');
    expect(res.status).toBe(404);
  });

  it('GET /view/key returns real content type from headObject (§18 E4)', async () => {
    // headObject is called on storage.service, but we use the route-level getKeyView
    // which needs the mocked headObject to return contentType
    const { headObject } = require('../../src/services/storage.service.js');
    (headObject as jest.Mock).mockResolvedValue({ size: 2048, checksum: 'etag', contentType: 'application/pdf' });

    const res = await request(makeApp()).get('/api/documents/view/key?key=borrowers/user-1/applications/app-1/documents/doc-1/report.pdf');
    expect(res.status).toBe(200);
    expect(res.body.data.contentType).toBe('application/pdf');
  });
});

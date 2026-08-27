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
    GetObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.view.url'),
}));

jest.mock('../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../src/lib/prisma.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import express from 'express';
import request from 'supertest';
import { documentsRouter } from '../src/routes/documents.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

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

beforeEach(() => {
  authed = true;
  (prisma.document.findUnique as jest.Mock).mockResolvedValue(DOC);
  (prisma.document.update as jest.Mock).mockResolvedValue({ ...DOC, applicationId: 'app-2' });
  (getSignedUrl as jest.Mock).mockResolvedValue('https://signed.view.url');
});

describe('documents viewer + link routes', () => {
  it('issues a presigned view url for an owned document', async () => {
    const res = await request(makeApp()).get('/api/documents/doc-1/view');
    expect(res.status).toBe(200);
    expect(res.body.data.viewUrl).toBe('https://signed.view.url');
    expect(res.body.data.fileName).toBe('report.pdf');
    expect(res.body.data.expiresIn).toBe(300);
  });

  it('rejects an unauthenticated view request with 401', async () => {
    authed = false;
    const res = await request(makeApp()).get('/api/documents/doc-1/view');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the document is missing', async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/documents/missing/view');
    expect(res.status).toBe(404);
  });

  it('links a document to an application', async () => {
    const res = await request(makeApp())
      .post('/api/documents/doc-1/link')
      .send({ applicationId: 'app-2', field: 'financials' });
    expect(res.status).toBe(200);
    expect(res.body.data.document.applicationId).toBe('app-2');
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { applicationId: 'app-2' },
    });
  });

  it('rejects a link request with no applicationId (400)', async () => {
    const res = await request(makeApp()).post('/api/documents/doc-1/link').send({});
    expect(res.status).toBe(400);
  });
});

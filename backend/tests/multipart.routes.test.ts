let authed = true

jest.mock('../src/middleware/authMiddleware.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    if (authed) {
      req.user = { id: 'user-1', email: 'a@b.co', role: 'BORROWER' }
    }
    next()
  },
  requireAuth: (req: any, _res: any, next: any) => {
    if (!req.user) {
      next({ statusCode: 401, message: 'Authentication required', isOperational: true })
      return
    }
    next()
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}))

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({})
  class S3Client {
    send = send
    constructor() {}
  }
  // Each command must be its own class so `instanceof` branching works.
  const makeCmd = () =>
    class {
      input: unknown
      constructor(input: unknown) {
        this.input = input
      }
    }
  return {
    S3Client,
    CreateMultipartUploadCommand: makeCmd(),
    CompleteMultipartUploadCommand: makeCmd(),
    AbortMultipartUploadCommand: makeCmd(),
    ListPartsCommand: makeCmd(),
    UploadPartCommand: makeCmd(),
    HeadObjectCommand: makeCmd(),
    HeadBucketCommand: makeCmd(),
    PutObjectCommand: makeCmd(),
    CreateBucketCommand: makeCmd(),
    PutPublicAccessBlockCommand: makeCmd(),
    PutBucketCorsCommand: makeCmd(),
    PutBucketLifecycleConfigurationCommand: makeCmd(),
  }
})

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://part.url'),
}))

jest.mock('../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    },
  },
}))

jest.mock('../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}))

import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand } from '@aws-sdk/client-s3'
import express from 'express'
import request from 'supertest'
import { documentsRouter } from '../src/routes/documents.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '../src/lib/prisma.js'

const MB = 1024 * 1024

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/documents', documentsRouter)
  app.use(errorHandler)
  return app
}

function setupMocks() {
  ;(getSignedUrl as jest.Mock).mockResolvedValue('https://part.url')
  ;(prisma.document.create as jest.Mock).mockResolvedValue({ id: 'doc-1' })
  new S3Client().send.mockImplementation((cmd: any) => {
    if (cmd instanceof CreateMultipartUploadCommand) return Promise.resolve({ UploadId: 'upload-1' })
    if (cmd instanceof CompleteMultipartUploadCommand) return Promise.resolve({})
    if (cmd instanceof AbortMultipartUploadCommand) return Promise.resolve({})
    if (cmd instanceof ListPartsCommand) return Promise.resolve({ Parts: [{ PartNumber: 1 }] })
    return Promise.resolve({})
  })
}

describe('documents multipart routes', () => {
  beforeEach(() => {
    authed = true
  })

  it('rejects unauthenticated multipart presign with 401', async () => {
    authed = false
    const res = await request(makeApp())
      .post('/api/documents/presign-multipart')
      .send({ applicationId: 'app-1', category: 'KYC', fileName: 'b.pdf', contentType: 'application/pdf', contentLength: 250 * MB })
    expect(res.status).toBe(401)
  })

  it('returns part URLs for a large file', async () => {
    setupMocks()
    const res = await request(makeApp())
      .post('/api/documents/presign-multipart')
      .send({ applicationId: 'app-1', category: 'KYC', fileName: 'b.pdf', contentType: 'application/pdf', contentLength: 250 * MB })
    expect(res.status).toBe(200)
    expect(res.body.data.uploadId).toBe('upload-1')
    expect(res.body.data.partUrls.length).toBeGreaterThan(1)
    expect(res.body.data.partSize).toBe(64 * MB)
    expect(res.body.data.concurrency).toBe(4)
  })

  it('rejects an oversized file with 400', async () => {
    setupMocks()
    const res = await request(makeApp())
      .post('/api/documents/presign-multipart')
      .send({ applicationId: 'app-1', category: 'KYC', fileName: 'b.pdf', contentType: 'application/pdf', contentLength: 6 * 1024 * 1024 * 1024 })
    expect(res.status).toBe(400)
  })

  it('completes a multipart upload', async () => {
    setupMocks()
    const res = await request(makeApp())
      .post('/api/documents/doc-1/complete-multipart')
      .send({
        applicationId: 'app-1',
        category: 'KYC',
        fileName: 'b.pdf',
        contentType: 'application/pdf',
        uploadId: 'upload-1',
        parts: [{ partNumber: 1, etag: 'etag-a' }],
      })
    expect(res.status).toBe(201)
    expect(res.body.data.document.id).toBe('doc-1')
  })

  it('aborts a multipart upload', async () => {
    setupMocks()
    const res = await request(makeApp())
      .post('/api/documents/multipart/upload-1/abort')
      .send({ applicationId: 'app-1', documentId: 'doc-1', fileName: 'b.pdf', uploadId: 'upload-1' })
    expect(res.status).toBe(200)
  })

  it('lists uploaded parts for resume', async () => {
    setupMocks()
    const res = await request(makeApp())
      .get('/api/documents/multipart/upload-1/parts?applicationId=app-1&documentId=doc-1&fileName=b.pdf')
    expect(res.status).toBe(200)
    expect(res.body.data.partNumbers).toEqual([1])
  })
})

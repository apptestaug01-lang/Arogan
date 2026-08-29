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
  const makeCmd = () =>
    class {
      input: unknown
      constructor(input: unknown) {
        this.input = input
      }
    }
  return {
    S3Client,
    ListObjectsV2Command: makeCmd(),
  }
})

jest.mock('../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}))

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { prisma } from '../src/lib/prisma.js'
import express from 'express'
import request from 'supertest'
import { documentsRouter } from '../src/routes/documents.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/documents', documentsRouter)
  app.use(errorHandler)
  return app
}

function setupSend(result: any) {
  ;(new S3Client() as any).send.mockImplementation((cmd: any) => {
    if (cmd instanceof ListObjectsV2Command) return Promise.resolve(result)
    return Promise.resolve({})
  })
}

describe('GET /api/documents/explorer', () => {
  beforeEach(() => {
    authed = true
    ;(prisma.document.findMany as jest.Mock).mockResolvedValue([])
  })

  it('rejects unauthenticated access with 401', async () => {
    authed = false
    const res = await request(makeApp()).get('/api/documents/explorer')
    expect(res.status).toBe(401)
  })

  it('returns folders and files via ListObjectsV2', async () => {
    setupSend({
      CommonPrefixes: [{ Prefix: 'borrowers/user-1/applications/' }],
      Contents: [
        { Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', Size: 1024, LastModified: new Date('2026-08-20T10:00:00Z') },
      ],
    })

    const res = await request(makeApp()).get('/api/documents/explorer')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.folders).toEqual([
      { name: 'applications', type: 'folder', key: 'borrowers/user-1/applications/' },
    ])
    expect(res.body.data.files[0].name).toBe('report.pdf')
    expect(res.body.data.nextToken).toBeNull()
  })

  it('denies a cross-borrower prefix', async () => {
    const res = await request(makeApp()).get('/api/documents/explorer?prefix=borrowers/user-2/')
    expect(res.status).toBe(400)
  })

  it('passes the continuation token through to S3', async () => {
    setupSend({ CommonPrefixes: [], Contents: [], NextContinuationToken: 'next-1' })

    const res = await request(makeApp()).get('/api/documents/explorer?continuation=next-1')
    expect(res.status).toBe(200)
    expect(res.body.data.nextToken).toBe('next-1')

    const sendCall = (new S3Client() as any).send.mock.calls.find(
      (c: any) => c[0] instanceof ListObjectsV2Command,
    )
    expect(sendCall[0].input.ContinuationToken).toBe('next-1')
  })

  it('rejects an overly long prefix', async () => {
    const res = await request(makeApp()).get(`/api/documents/explorer?prefix=${'a'.repeat(501)}`)
    expect(res.status).toBe(400)
  })

  it('rejects an overly long continuation token', async () => {
    const res = await request(makeApp()).get(`/api/documents/explorer?continuation=${'a'.repeat(501)}`)
    expect(res.status).toBe(400)
  })
})

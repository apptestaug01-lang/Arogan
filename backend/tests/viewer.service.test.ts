jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.view.url'),
}))

jest.mock('../src/lib/prisma.js', () => ({
  prisma: {
    document: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    application: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('../src/services/audit.service.js', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}))

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '../src/lib/prisma.js'
import { logAuditEvent } from '../src/services/audit.service.js'
import { getDocumentView, DocumentViewError } from '../src/services/viewer.service.js'
import { linkDocument } from '../src/services/link.service.js'

const DOC = {
  id: 'doc-1',
  userId: 'user-1',
  applicationId: 'app-1',
  s3Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf',
  originalName: 'report.pdf',
  contentType: 'application/pdf',
  size: 2048,
  status: 'UPLOADED',
}

beforeEach(() => {
  ;(getSignedUrl as jest.Mock).mockResolvedValue('https://signed.view.url')
  ;(prisma.document.findUnique as jest.Mock).mockResolvedValue(DOC)
  ;(prisma.document.update as jest.Mock).mockResolvedValue({ ...DOC, applicationId: 'app-2' })
  ;(prisma.application.findUnique as jest.Mock).mockResolvedValue({ id: 'app-2', userId: 'user-1', applicationId: 'app-2' })
  ;(logAuditEvent as jest.Mock).mockResolvedValue(undefined)
})

describe('getDocumentView', () => {
  it('returns a presigned GET url scoped to the document key (TTL 5m)', async () => {
    const res = await getDocumentView({ userId: 'user-1', documentId: 'doc-1' })

    expect(res.viewUrl).toBe('https://signed.view.url')
    expect(res.fileName).toBe('report.pdf')
    expect(res.contentType).toBe('application/pdf')
    expect(res.size).toBe(2048)
    expect(res.status).toBe('UPLOADED')
    expect(res.expiresIn).toBe(300)
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: expect.objectContaining({ Key: DOC.s3Key }) }),
      { expiresIn: 300 },
    )
    expect(logAuditEvent).toHaveBeenCalledWith(
      'DOCUMENT_VIEW',
      undefined,
      undefined,
      'user-1',
      expect.objectContaining({ documentId: 'doc-1' }),
    )
  })

  it('throws 404 when the document does not exist', async () => {
    ;(prisma.document.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(
      getDocumentView({ userId: 'user-1', documentId: 'missing' }),
    ).rejects.toBeInstanceOf(DocumentViewError)
    await expect(
      getDocumentView({ userId: 'user-1', documentId: 'missing' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('denies a document owned by another user (403)', async () => {
    ;(prisma.document.findUnique as jest.Mock).mockResolvedValue({ ...DOC, userId: 'user-2' })
    await expect(
      getDocumentView({ userId: 'user-1', documentId: 'doc-1' }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('linkDocument', () => {
  it('re-links the document to the given application', async () => {
    const res = await linkDocument({
      userId: 'user-1',
      documentId: 'doc-1',
      applicationId: 'app-2',
      field: 'financials',
    })

    expect(res.applicationId).toBe('app-2')
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { applicationId: 'app-2' },
    })
    expect(logAuditEvent).toHaveBeenCalledWith(
      'DOCUMENT_LINKED',
      undefined,
      undefined,
      'user-1',
      expect.objectContaining({ applicationId: 'app-2', field: 'financials' }),
    )
  })

  it('returns the document unchanged when linking to the same application', async () => {
    ;(prisma.document.findUnique as jest.Mock).mockResolvedValue(DOC)
    const res = await linkDocument({
      userId: 'user-1',
      documentId: 'doc-1',
      applicationId: 'app-1',
    })

    expect(res.applicationId).toBe('app-1')
    expect(prisma.document.update).not.toHaveBeenCalled()
  })

  it('throws 404 when the document does not exist', async () => {
    ;(prisma.document.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(
      linkDocument({ userId: 'user-1', documentId: 'missing', applicationId: 'app-2' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('denies linking a document owned by another user (403)', async () => {
    ;(prisma.document.findUnique as jest.Mock).mockResolvedValue({ ...DOC, userId: 'user-2' })
    await expect(
      linkDocument({ userId: 'user-1', documentId: 'doc-1', applicationId: 'app-2' }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('denies linking to an application owned by another user (403)', async () => {
    ;(prisma.application.findUnique as jest.Mock).mockResolvedValue({ id: 'app-2', userId: 'user-2', applicationId: 'app-2' })
    await expect(
      linkDocument({ userId: 'user-1', documentId: 'doc-1', applicationId: 'app-2' }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('denies linking to a non-existent application (403)', async () => {
    ;(prisma.application.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(
      linkDocument({ userId: 'user-1', documentId: 'doc-1', applicationId: 'missing' }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

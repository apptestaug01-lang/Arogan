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

import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand, HeadObjectCommand, UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '../src/lib/prisma.js'
import { logAuditEvent } from '../src/services/audit.service.js'
import {
  computeChunkPlan,
  presignMultipart,
  completeMultipart,
  abortMultipart,
  listUploadedParts,
} from '../src/services/multipart.service.js'
import { buildDocumentKey } from '../src/utils/documentKey.js'

const MB = 1024 * 1024
const GB = 1024 * MB

// resetMocks wipes beforeEach implementations (including the factory defaults
// for getSignedUrl / prisma), so establish every mock inside each test (after the
// auto-reset) via this helper.
function setupSend(override?: (cmd: any) => any) {
  ;(getSignedUrl as jest.Mock).mockResolvedValue('https://part.url')
  ;(prisma.document.create as jest.Mock).mockResolvedValue({ id: 'doc-1' })
  ;(new S3Client() as any).send.mockImplementation((cmd: any) => {
    if (override) {
      const o = override(cmd)
      if (o !== undefined) return o
    }
    if (cmd instanceof CreateMultipartUploadCommand) return Promise.resolve({ UploadId: 'upload-1' })
    if (cmd instanceof HeadObjectCommand) return Promise.resolve({ ContentLength: 999, ETag: '"etag1"' })
    if (cmd instanceof CompleteMultipartUploadCommand) return Promise.resolve({})
    if (cmd instanceof AbortMultipartUploadCommand) return Promise.resolve({})
    if (cmd instanceof ListPartsCommand) return Promise.resolve({ Parts: [{ PartNumber: 1 }] })
    return Promise.resolve({})
  })
}

const INPUT = {
  userId: 'user-1',
  applicationId: 'app-1',
  category: 'KYC',
  fileName: 'big.pdf',
  contentType: 'application/pdf',
  contentLength: 250 * MB,
}

describe('computeChunkPlan', () => {
  it('splits 250 MB into 64 MB parts', () => {
    const plan = computeChunkPlan(250 * MB)
    expect(plan.partSize).toBe(64 * MB)
    expect(plan.totalParts).toBe(Math.ceil((250 * MB) / (64 * MB)))
    expect(plan.concurrency).toBe(4)
  })

  it('keeps a 5 GB file under the 10,000-part ceiling', () => {
    const plan = computeChunkPlan(5 * GB)
    expect(plan.totalParts).toBeLessThanOrEqual(10000)
  })

  it('rejects files above the 5 GB cap', () => {
    expect(() => computeChunkPlan(6 * GB)).toThrow('File exceeds maximum size')
  })
})

describe('presignMultipart', () => {
  it('issues one presigned URL per part and binds uploadId/part numbers', async () => {
    setupSend()
    const result = await presignMultipart(INPUT)
    const expectedKey = buildDocumentKey('user-1', 'app-1', result.documentId, 'big.pdf')
    const totalParts = Math.ceil((250 * MB) / (64 * MB))

    expect(result.uploadId).toBe('upload-1')
    expect(result.key).toBe(expectedKey)
    expect(result.partUrls).toHaveLength(totalParts)
    expect(result.partUrls.every((u) => u === 'https://part.url')).toBe(true)
    expect(result.partSize).toBe(64 * MB)
    expect(result.concurrency).toBe(4)
    expect(result.abortAfterDays).toBe(7)

    const calls = (getSignedUrl as jest.Mock).mock.calls
    expect(calls).toHaveLength(totalParts)
    calls.forEach((call, i) => {
      expect(call[1]).toBeInstanceOf(UploadPartCommand)
      expect(call[1].input.PartNumber).toBe(i + 1)
      expect(call[1].input.UploadId).toBe('upload-1')
    })

    const createCall = (new S3Client() as any).send.mock.calls.find(
      (c: any) => c[0] instanceof CreateMultipartUploadCommand,
    )
    expect(createCall[0].input.Key).toBe(expectedKey)
    expect(createCall[0].input.ContentType).toBe('application/pdf')
    expect(logAuditEvent).toHaveBeenCalledWith(
      'DOCUMENT_MULTIPART_PRESIGN',
      undefined,
      undefined,
      'user-1',
      expect.objectContaining({ uploadId: 'upload-1', totalParts }),
    )
  })

  it('rejects files under the 100 MB threshold', async () => {
    setupSend()
    await expect(presignMultipart({ ...INPUT, contentLength: 10 * MB })).rejects.toThrow(
      'single-part upload',
    )
  })
})

describe('completeMultipart', () => {
  it('completes the upload and records the document from storage metadata', async () => {
    setupSend()
    const result = await completeMultipart({
      userId: 'user-1',
      documentId: 'doc-1',
      applicationId: 'app-1',
      category: 'KYC',
      fileName: 'big.pdf',
      contentType: 'application/pdf',
      uploadId: 'upload-1',
      parts: [
        { partNumber: 2, etag: 'etag-b' },
        { partNumber: 1, etag: 'etag-a' },
      ],
    })

    const expectedKey = buildDocumentKey('user-1', 'app-1', 'doc-1', 'big.pdf')
    expect(result.id).toBe('doc-1')

    const completeCall = (new S3Client() as any).send.mock.calls.find(
      (c: any) => c[0] instanceof CompleteMultipartUploadCommand,
    )
    expect(completeCall[0].input.MultipartUpload.Parts).toEqual([
      { PartNumber: 1, ETag: 'etag-a' },
      { PartNumber: 2, ETag: 'etag-b' },
    ])

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        id: 'doc-1',
        userId: 'user-1',
        applicationId: 'app-1',
        category: 'KYC',
        s3Key: expectedKey,
        originalName: 'big.pdf',
        contentType: 'application/pdf',
        size: 999,
        checksum: 'etag1',
        status: 'UPLOADED',
      },
    })
  })

  it('fails when the assembled object is missing from storage', async () => {
    setupSend((cmd) =>
      cmd instanceof HeadObjectCommand ? Promise.reject(new Error('NotFound')) : undefined,
    )
    await expect(
      completeMultipart({
        userId: 'user-1',
        documentId: 'doc-1',
        applicationId: 'app-1',
        category: 'KYC',
        fileName: 'big.pdf',
        contentType: 'application/pdf',
        uploadId: 'upload-1',
        parts: [{ partNumber: 1, etag: 'etag-a' }],
      }),
    ).rejects.toThrow('Uploaded object not found in storage')
  })
})

describe('abortMultipart / listUploadedParts', () => {
  it('aborts the multipart upload', async () => {
    setupSend()
    await abortMultipart({
      userId: 'user-1',
      applicationId: 'app-1',
      documentId: 'doc-1',
      fileName: 'big.pdf',
      uploadId: 'upload-1',
    })
    const abortCall = (new S3Client() as any).send.mock.calls.find(
      (c: any) => c[0] instanceof AbortMultipartUploadCommand,
    )
    expect(abortCall).toBeTruthy()
  })

  it('lists already-uploaded parts for resume', async () => {
    setupSend()
    const parts = await listUploadedParts({
      userId: 'user-1',
      applicationId: 'app-1',
      documentId: 'doc-1',
      fileName: 'big.pdf',
      uploadId: 'upload-1',
    })
    expect(parts).toEqual([1])
  })
})

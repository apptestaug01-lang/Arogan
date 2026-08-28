import { randomUUID } from 'crypto'
import {
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from '@aws-sdk/client-s3'
import { prisma } from '../lib/prisma.js'
import { buildDocumentKey } from '../utils/documentKey.js'
import { createPresignedUploadPartUrl, getStorageClient, headObject } from './storage.service.js'
import { getStorageConfig } from '../config/storage.config.js'
import { logAuditEvent } from './audit.service.js'
import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  MULTIPART_PART_SIZE_BYTES,
  MULTIPART_CONCURRENCY,
  MULTIPART_MAX_PARTS,
  MULTIPART_ABORT_DAYS,
  PRESIGNED_UPLOAD_TTL_SECONDS,
} from '../utils/constants.js'

export interface ChunkPlan {
  partSize: number
  totalParts: number
  concurrency: number
}

// Expert chunking strategy:
// - 64 MB parts by default; grown only if the file would exceed 10,000 parts (S3 ceiling).
// - Each non-final part is >= 5 MB (guaranteed by 64 MB default); last part is the remainder.
// - Concurrency (4) is a client hint for parallel part uploads.
export function computeChunkPlan(size: number): ChunkPlan {
  if (size <= 0) {
    throw new Error('Invalid file size')
  }
  if (size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error('File exceeds maximum size')
  }
  let partSize = MULTIPART_PART_SIZE_BYTES
  if (Math.ceil(size / partSize) > MULTIPART_MAX_PARTS) {
    partSize = Math.ceil(size / MULTIPART_MAX_PARTS)
  }
  const totalParts = Math.ceil(size / partSize)
  return { partSize, totalParts, concurrency: MULTIPART_CONCURRENCY }
}

export interface PresignMultipartInput {
  userId: string
  applicationId: string
  category: string
  fileName: string
  contentType: string
  contentLength: number
}

export interface PresignMultipartResult {
  documentId: string
  key: string
  uploadId: string
  partUrls: string[]
  partSize: number
  totalParts: number
  concurrency: number
  expiresIn: number
  abortAfterDays: number
}

export async function presignMultipart(input: PresignMultipartInput): Promise<PresignMultipartResult> {
  if (!ALLOWED_DOCUMENT_CONTENT_TYPES.includes(input.contentType)) {
    throw new Error('Unsupported content type')
  }
  if (input.contentLength <= 0 || input.contentLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error('Invalid file size')
  }
  if (input.contentLength < MULTIPART_THRESHOLD_BYTES) {
    throw new Error('Use the single-part upload endpoint for files under 100 MB')
  }

  const documentId = randomUUID()
  const key = buildDocumentKey(input.userId, input.applicationId, input.category, documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  const createRes = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.contentType,
    }),
  )
  const uploadId = createRes.UploadId as string

  const { partSize, totalParts, concurrency } = computeChunkPlan(input.contentLength)
  const partUrls: string[] = []
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    partUrls.push(
      await createPresignedUploadPartUrl(
        key,
        uploadId,
        partNumber,
        PRESIGNED_UPLOAD_TTL_SECONDS,
        s3,
        config,
      ),
    )
  }

  await logAuditEvent('DOCUMENT_MULTIPART_PRESIGN', undefined, undefined, input.userId, {
    applicationId: input.applicationId,
    category: input.category,
    key,
    uploadId,
    totalParts,
  })

  return {
    documentId,
    key,
    uploadId,
    partUrls,
    partSize,
    totalParts,
    concurrency,
    expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
    abortAfterDays: MULTIPART_ABORT_DAYS,
  }
}

export interface CompleteMultipartInput {
  userId: string
  documentId: string
  applicationId: string
  category: string
  fileName: string
  contentType: string
  uploadId: string
  parts: { partNumber: number; etag: string }[]
}

export async function completeMultipart(input: CompleteMultipartInput) {
  const key = buildDocumentKey(input.userId, input.applicationId, input.category, input.documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  const ordered = [...input.parts].sort((a, b) => a.partNumber - b.partNumber)
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: ordered.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  )

  let meta
  try {
    meta = await headObject(key, s3, config)
  } catch {
    throw new Error('Uploaded object not found in storage')
  }

  const document = await prisma.document.create({
    data: {
      id: input.documentId,
      userId: input.userId,
      applicationId: input.applicationId,
      category: input.category,
      s3Key: key,
      originalName: input.fileName,
      contentType: input.contentType,
      size: meta.size,
      checksum: meta.checksum,
      status: 'UPLOADED',
    },
  })

  await logAuditEvent('DOCUMENT_UPLOADED', undefined, undefined, input.userId, {
    documentId: input.documentId,
    key,
    multipart: true,
  })

  return document
}

export interface MultipartKeyInput {
  userId: string
  applicationId: string
  category: string
  documentId: string
  fileName: string
}

export async function abortMultipart(input: MultipartKeyInput & { uploadId: string }): Promise<void> {
  const key = buildDocumentKey(input.userId, input.applicationId, input.category, input.documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  await s3.send(
    new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: key, UploadId: input.uploadId }),
  )

  await logAuditEvent('DOCUMENT_MULTIPART_ABORT', undefined, undefined, input.userId, {
    key,
    uploadId: input.uploadId,
  })
}

export async function listUploadedParts(
  input: MultipartKeyInput & { uploadId: string },
): Promise<number[]> {
  const key = buildDocumentKey(input.userId, input.applicationId, input.category, input.documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  const res = await s3.send(
    new ListPartsCommand({ Bucket: config.bucket, Key: key, UploadId: input.uploadId }),
  )
  return (res.Parts || []).map((p) => p.PartNumber as number)
}


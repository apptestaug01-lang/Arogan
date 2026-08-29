import { randomUUID } from 'crypto'
import {
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from '@aws-sdk/client-s3'
import { prisma } from '../lib/prisma.js'
import { buildDocumentKey } from '../utils/documentKey.js'
import { createPresignedUploadPartUrl, getStorageClient, headObject, ensureBucket } from './storage.service.js'
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
import { ValidationError, StorageError, ConflictError } from '../utils/errors.js'

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
    throw new ValidationError('Unsupported file type. Supported formats: PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX')
  }
  if (input.contentLength <= 0) {
    throw new ValidationError('Invalid file size')
  }
  if (input.contentLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new ValidationError(`File size exceeds the ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024 * 1024)} GB limit`)
  }
  if (input.contentLength < MULTIPART_THRESHOLD_BYTES) {
    throw new ValidationError(`Files under ${MULTIPART_THRESHOLD_BYTES / (1024 * 1024)} MB should use the standard upload`)
  }

  const documentId = randomUUID()
  const key = buildDocumentKey(input.userId, input.applicationId, documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  let createRes
  try {
    await ensureBucket()
    createRes = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: input.contentType,
      }),
    )
  } catch (err) {
    throw new StorageError(
      err instanceof Error ? err.message : 'Storage service is temporarily unavailable. Please try again.',
    )
  }
  const uploadId = createRes.UploadId as string

  const { partSize, totalParts, concurrency } = computeChunkPlan(input.contentLength)
  const partUrls: string[] = []
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    try {
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
    } catch (err) {
      throw new StorageError(
        err instanceof Error ? err.message : 'Failed to generate upload URLs. Please try again.',
      )
    }
  }

  await logAuditEvent('DOCUMENT_MULTIPART_PRESIGN', undefined, undefined, input.userId, {
    applicationId: input.applicationId,
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
  fileName: string
  contentType: string
  uploadId: string
  parts: { partNumber: number; etag: string }[]
}

export async function completeMultipart(input: CompleteMultipartInput) {
  const key = buildDocumentKey(input.userId, input.applicationId, input.documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  const ordered = [...input.parts].sort((a, b) => a.partNumber - b.partNumber)
  try {
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
  } catch (err) {
    throw new StorageError(
      err instanceof Error ? err.message : 'Failed to complete multipart upload. Please try again.',
    )
  }

  let meta
  try {
    meta = await headObject(key, s3, config)
  } catch {
    throw new StorageError('Uploaded file not found in storage after completion.')
  }

  try {
    const document = await prisma.document.create({
      data: {
        id: input.documentId,
        userId: input.userId,
        applicationId: input.applicationId,
        category: 'Documents',
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
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
      throw new ConflictError('A document with this name already exists. Please rename the file and try again.')
    }
    throw new StorageError('Failed to record document. Please try again.')
  }
}

export interface MultipartKeyInput {
  userId: string
  applicationId: string
  documentId: string
  fileName: string
}

export async function abortMultipart(input: MultipartKeyInput & { uploadId: string }): Promise<void> {
  const key = buildDocumentKey(input.userId, input.applicationId, input.documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  try {
    await s3.send(
      new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: key, UploadId: input.uploadId }),
    )
  } catch {
    // Best-effort abort; log but don't fail the request
  }

  await logAuditEvent('DOCUMENT_MULTIPART_ABORT', undefined, undefined, input.userId, {
    key,
    uploadId: input.uploadId,
  })
}

export async function listUploadedParts(
  input: MultipartKeyInput & { uploadId: string },
): Promise<number[]> {
  const key = buildDocumentKey(input.userId, input.applicationId, input.documentId, input.fileName)
  const s3 = getStorageClient()
  const config = getStorageConfig()

  let res
  try {
    res = await s3.send(
      new ListPartsCommand({ Bucket: config.bucket, Key: key, UploadId: input.uploadId }),
    )
  } catch (err) {
    throw new StorageError(
      err instanceof Error ? err.message : 'Storage service is temporarily unavailable. Please try again.',
    )
  }
  return (res.Parts || []).map((p) => p.PartNumber as number)
}


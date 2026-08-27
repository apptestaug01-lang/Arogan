import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { buildDocumentKey } from '../utils/documentKey.js'
import { createPresignedUploadUrl, headObject } from './storage.service.js'
import { logAuditEvent } from './audit.service.js'
import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  PRESIGNED_UPLOAD_TTL_SECONDS,
} from '../utils/constants.js'

export interface PresignDocumentInput {
  userId: string
  applicationId: string
  category: string
  fileName: string
  contentType: string
  contentLength: number
}

export interface CompleteDocumentInput {
  userId: string
  documentId: string
  applicationId: string
  category: string
  fileName: string
  contentType: string
}

export async function presignDocument(input: PresignDocumentInput) {
  if (!ALLOWED_DOCUMENT_CONTENT_TYPES.includes(input.contentType)) {
    throw new Error('Unsupported content type')
  }
  if (input.contentLength <= 0 || input.contentLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error('Invalid file size')
  }

  const documentId = randomUUID()
  const key = buildDocumentKey(input.userId, input.applicationId, documentId, input.fileName)
  const uploadUrl = await createPresignedUploadUrl(
    key,
    input.contentType,
    input.contentLength,
    PRESIGNED_UPLOAD_TTL_SECONDS,
  )

  await logAuditEvent('DOCUMENT_PRESIGN', undefined, undefined, input.userId, {
    applicationId: input.applicationId,
    category: input.category,
    key,
  })

  return { documentId, key, uploadUrl, expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS }
}

export async function completeDocument(input: CompleteDocumentInput) {
  const key = buildDocumentKey(input.userId, input.applicationId, input.documentId, input.fileName)

  let meta
  try {
    meta = await headObject(key)
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
  })

  return document
}

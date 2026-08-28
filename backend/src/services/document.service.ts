import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { buildDocumentKey } from '../utils/documentKey.js'
import { createPresignedUploadUrl, headObject, deleteObject } from './storage.service.js'
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
  const key = buildDocumentKey(input.userId, input.applicationId, input.category, documentId, input.fileName)
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
  const key = buildDocumentKey(input.userId, input.applicationId, input.category, input.documentId, input.fileName)

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

export interface DeleteDocumentInput {
  userId: string
  documentId: string
}

export class DocumentDeleteError extends Error {
  statusCode: number
  isOperational: boolean
  constructor(message: string, statusCode = 404) {
    super(message)
    this.name = 'DocumentDeleteError'
    this.statusCode = statusCode
    this.isOperational = true
  }
}

export interface ListUserDocumentsInput {
  userId: string
  category?: string
}

export interface DocumentSummary {
  id: string
  applicationId: string
  category: string
  originalName: string
  contentType: string
  size: number | null
  status: string
  createdAt: string
  updatedAt: string
}

export async function listUserDocuments(input: ListUserDocumentsInput): Promise<DocumentSummary[]> {
  const docs = await prisma.document.findMany({
    where: {
      userId: input.userId,
      status: { not: 'DELETED' },
      ...(input.category ? { category: input.category } : {}),
    },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  })

  return docs.map((d) => ({
    id: d.id,
    applicationId: d.applicationId,
    category: d.category,
    originalName: d.originalName,
    contentType: d.contentType,
    size: d.size,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }))
}

export interface BulkDeleteInput {
  userId: string
  documentIds: string[]
}

export async function bulkDeleteDocuments(input: BulkDeleteInput) {
  const ids = [...new Set(input.documentIds)].filter(Boolean)
  if (ids.length === 0) return { deleted: 0, results: [] as unknown[] }

  const docs = await prisma.document.findMany({
    where: { id: { in: ids }, userId: input.userId, status: { not: 'DELETED' } },
  })

  const results = await Promise.all(
    docs.map(async (doc) => {
      try {
        await deleteObject(doc.s3Key).catch((err) => {
          logAuditEvent('DOCUMENT_DELETE_OBJECT_FAILED', undefined, undefined, input.userId, {
            documentId: doc.id,
            key: doc.s3Key,
            error: err instanceof Error ? err.message : String(err),
          }).catch(() => {})
        })
        await prisma.document.update({ where: { id: doc.id }, data: { status: 'DELETED' } })
        await logAuditEvent('DOCUMENT_DELETED', undefined, undefined, input.userId, {
          documentId: doc.id,
          key: doc.s3Key,
        })
        return { id: doc.id, status: 'DELETED' as const }
      } catch (err) {
        return {
          id: doc.id,
          status: 'ERROR' as const,
          error: err instanceof Error ? err.message : 'Failed to delete',
        }
      }
    }),
  )

  return { deleted: docs.length, results }
}

export async function deleteDocument(input: DeleteDocumentInput) {
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } })
  if (!doc) {
    throw new DocumentDeleteError('Document not found', 404)
  }
  if (doc.userId !== input.userId) {
    throw new DocumentDeleteError('Not authorized to delete this document', 403)
  }
  if (doc.status === 'DELETED') {
    throw new DocumentDeleteError('Document already deleted', 409)
  }

  // Best-effort object deletion. A missing object shouldn't block the
  // metadata update — record the audit trail regardless.
  await deleteObject(doc.s3Key).catch((err) => {
    logAuditEvent('DOCUMENT_DELETE_OBJECT_FAILED', undefined, undefined, input.userId, {
      documentId: doc.id,
      key: doc.s3Key,
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {})
  })

  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'DELETED' },
  })

  await logAuditEvent('DOCUMENT_DELETED', undefined, undefined, input.userId, {
    documentId: doc.id,
    key: doc.s3Key,
  })

  return { id: doc.id, status: 'DELETED' }
}

import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { buildDocumentKey } from '../utils/documentKey.js'
import { createPresignedUploadUrl, headObject, deleteObject, ensureBucket } from './storage.service.js'
import { logAuditEvent } from './audit.service.js'
import { triggerExtraction } from '../utils/triggerExtraction.js'
import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  PRESIGNED_UPLOAD_TTL_SECONDS,
} from '../utils/constants.js'
import { ValidationError, StorageError, ConflictError } from '../utils/errors.js'
import { archiveWorker } from '../modules/documentArchive/worker.js'

export interface PresignDocumentInput {
  userId: string
  applicationId: string
  fileName: string
  contentType: string
  contentLength: number
}

export interface CompleteDocumentInput {
  userId: string
  documentId: string
  applicationId: string
  fileName: string
  contentType: string
}

export async function presignDocument(input: PresignDocumentInput) {
  if (!ALLOWED_DOCUMENT_CONTENT_TYPES.includes(input.contentType)) {
    throw new ValidationError('Unsupported file type. Supported formats: PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX')
  }
  if (input.contentLength <= 0) {
    throw new ValidationError('Invalid file size')
  }
  if (input.contentLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new ValidationError(`File size exceeds the ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024 * 1024)} GB limit`)
  }

  const documentId = randomUUID()
  const key = buildDocumentKey(input.userId, input.applicationId, documentId, input.fileName)
  let uploadUrl: string
  try {
    await ensureBucket()
    uploadUrl = await createPresignedUploadUrl(
      key,
      input.contentType,
      input.contentLength,
      PRESIGNED_UPLOAD_TTL_SECONDS,
    )
  } catch (err) {
    // Log the actual error for debugging
    console.error('[DocumentService] Presign error:', err instanceof Error ? err.message : String(err))
    throw new StorageError(
      err instanceof Error ? `Storage error: ${err.message}` : 'Storage service is temporarily unavailable. Please try again.',
    )
  }

  await logAuditEvent('DOCUMENT_PRESIGN', undefined, undefined, input.userId, {
    applicationId: input.applicationId,
    key,
  })

  return { documentId, key, uploadUrl, expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS }
}

export async function completeDocument(input: CompleteDocumentInput) {
  const key = buildDocumentKey(input.userId, input.applicationId, input.documentId, input.fileName)

  let meta
  try {
    await ensureBucket()
    meta = await headObject(key)
  } catch {
    throw new StorageError('Uploaded file not found in storage. The upload may have expired or failed.')
  }

  const existing = await prisma.document.findFirst({
    where: {
      userId: input.userId,
      applicationId: input.applicationId,
      originalName: input.fileName,
      status: { not: 'DELETED' },
    },
  })

  if (existing) {
    throw new ConflictError('A document with this name already exists. Please rename the file and try again.')
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
  })
  triggerExtraction(input.userId, input.documentId)
  void archiveWorker.enqueue(input.documentId, input.userId)
  return document
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
      throw new ConflictError('A document with this name already exists. Please rename the file and try again.')
    }
    throw new StorageError('Failed to record document. Please try again.')
  }
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
  category: string | null
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
    orderBy: [{ createdAt: 'desc' }],
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

  // Clear any cached extraction so a re-upload with the same id (or a new
  // document of the same name) starts from a clean slate. The
  // onDelete: Cascade on the relation only fires on hard delete, which
  // we don't do here — we soft-delete the document, so the extraction row
  // must be removed explicitly.
  await prisma.documentExtraction
    .deleteMany({ where: { documentId: doc.id } })
    .catch(() => {})

  await logAuditEvent('DOCUMENT_DELETED', undefined, undefined, input.userId, {
    documentId: doc.id,
    key: doc.s3Key,
  })

  return { id: doc.id, status: 'DELETED' }
}

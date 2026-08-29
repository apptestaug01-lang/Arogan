import { prisma } from '../lib/prisma.js'
import { createPresignedDownloadUrl } from './storage.service.js'
import { PRESIGNED_DOWNLOAD_TTL_SECONDS } from '../utils/constants.js'
import { logAuditEvent } from './audit.service.js'
import { StorageError } from '../utils/errors.js'

export class DocumentViewError extends Error {
  statusCode: number
  isOperational: boolean
  constructor(message: string, statusCode = 404) {
    super(message)
    this.name = 'DocumentViewError'
    this.statusCode = statusCode
    this.isOperational = true
  }
}

export interface GetDocumentViewInput {
  userId: string
  documentId: string
}

export interface DocumentViewResult {
  documentId: string
  fileName: string
  contentType: string
  size: number
  status: string
  viewUrl: string
  expiresIn: number
}

export async function getDocumentView(
  input: GetDocumentViewInput,
): Promise<DocumentViewResult> {
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } })
  if (!doc) {
    throw new DocumentViewError('Document not found', 404)
  }
  if (doc.userId !== input.userId) {
    throw new DocumentViewError('Not authorized to view this document', 403)
  }

  let viewUrl: string
  try {
    viewUrl = await createPresignedDownloadUrl(
      doc.s3Key,
      PRESIGNED_DOWNLOAD_TTL_SECONDS,
    )
  } catch (err) {
    throw new StorageError(
      err instanceof Error ? err.message : 'Storage service unavailable',
    )
  }

  await logAuditEvent('DOCUMENT_VIEW', undefined, undefined, input.userId, {
    documentId: doc.id,
    key: doc.s3Key,
  })

  return {
    documentId: doc.id,
    fileName: doc.originalName,
    contentType: doc.contentType,
    size: doc.size,
    status: doc.status,
    viewUrl,
    expiresIn: PRESIGNED_DOWNLOAD_TTL_SECONDS,
  }
}

import { prisma } from '../lib/prisma.js'
import { logAuditEvent } from './audit.service.js'
import { DocumentViewError } from './viewer.service.js'

export interface LinkDocumentInput {
  userId: string
  documentId: string
  applicationId: string
  field?: string
}

export async function linkDocument(input: LinkDocumentInput) {
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } })
  if (!doc) {
    throw new DocumentViewError('Document not found', 404)
  }
  if (doc.userId !== input.userId) {
    throw new DocumentViewError('Not authorized to link this document', 403)
  }

  if (doc.applicationId === input.applicationId) {
    return doc
  }

  const application = await prisma.application.findUnique({
    where: { applicationId: input.applicationId },
  })
  if (!application || application.userId !== input.userId) {
    throw new DocumentViewError('Application not found or not authorized', 403)
  }

  const updated = await prisma.document.update({
    where: { id: input.documentId },
    data: { applicationId: input.applicationId },
  })

  await logAuditEvent('DOCUMENT_LINKED', undefined, undefined, input.userId, {
    documentId: input.documentId,
    applicationId: input.applicationId,
    field: input.field,
  })

  return updated
}

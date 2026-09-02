import { Router, Response, NextFunction } from 'express'
import { authMiddleware, requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validateRequest.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { presignDocument, completeDocument, deleteDocument, listUserDocuments, bulkDeleteDocuments } from '../services/document.service.js'
import {
  presignMultipart,
  completeMultipart,
  abortMultipart,
  listUploadedParts,
} from '../services/multipart.service.js'
import { listExplorer } from '../services/explorer.service.js'
import { getDocumentView } from '../services/viewer.service.js'
import { linkDocument } from '../services/link.service.js'
import { AutoFillService } from '../modules/documentExtraction/autoFillService.js'
import {
  documentPresignSchema,
  documentCompleteSchema,
  completeMultipartSchema,
  abortMultipartSchema,
  linkDocumentSchema,
  explorerQuerySchema,
} from '../utils/validation.js'

const router = Router()

router.post(
  '/presign',
  authMiddleware,
  requireAuth,
  validate(documentPresignSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body
      const result = await presignDocument({
        userId: req.user!.id,
        applicationId: body.applicationId,
        fileName: body.fileName,
        contentType: body.contentType,
        contentLength: body.contentLength,
      })
      sendSuccess(res, 'Upload URL issued', result, 200)
    } catch (err) {
      next(err)
    }
  },
)

router.get(
  '/explorer',
  authMiddleware,
  requireAuth,
  validate(explorerQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { prefix, continuation } = req.query as {
        prefix?: string
        continuation?: string
      }
      const result = await listExplorer({
        userId: req.user!.id,
        prefix,
        continuationToken: continuation,
      })
      sendSuccess(res, 'Explorer listing', result)
    } catch (err) {
      next(err)
    }
  },
)

router.get(
  '/documents',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const documents = await listUserDocuments({
        userId: req.user!.id,
      })
      sendSuccess(res, 'Documents listed', { documents })
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/:documentId/complete',
  authMiddleware,
  requireAuth,
  validate(documentCompleteSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body
      const document = await completeDocument({
        userId: req.user!.id,
        documentId: req.params.documentId,
        applicationId: body.applicationId,
        fileName: body.fileName,
        contentType: body.contentType,
      })
      sendSuccess(res, 'Document recorded', { document }, 201)
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/presign-multipart',
  authMiddleware,
  requireAuth,
  validate(documentPresignSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body
      const result = await presignMultipart({
        userId: req.user!.id,
        applicationId: body.applicationId,
        fileName: body.fileName,
        contentType: body.contentType,
        contentLength: body.contentLength,
      })
      sendSuccess(res, 'Multipart upload initiated', result, 200)
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/:documentId/complete-multipart',
  authMiddleware,
  requireAuth,
  validate(completeMultipartSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body
      const document = await completeMultipart({
        userId: req.user!.id,
        documentId: req.params.documentId,
        applicationId: body.applicationId,
        fileName: body.fileName,
        contentType: body.contentType,
        uploadId: body.uploadId,
        parts: body.parts,
      })
      sendSuccess(res, 'Document recorded', { document }, 201)
    } catch (err) {
      next(err)
    }
  },
)

router.get(
  '/:documentId/view',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await getDocumentView({
        userId: req.user!.id,
        documentId: req.params.documentId,
      })
      sendSuccess(res, 'View URL issued', result)
    } catch (err) {
      next(err)
    }
  },
)

const autoFillService = new AutoFillService()

router.post(
  '/:documentId/extract',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await autoFillService.extractFromDocument(req.user!.id, req.params.documentId)
      sendSuccess(res, 'Document extracted', result)
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/:documentId/link',
  authMiddleware,
  requireAuth,
  validate(linkDocumentSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId, field } = req.body
      const document = await linkDocument({
        userId: req.user!.id,
        documentId: req.params.documentId,
        applicationId,
        field,
      })
      sendSuccess(res, 'Document linked to form', { document })
    } catch (err) {
      next(err)
    }
  },
)

router.delete(
  '/:documentId',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await deleteDocument({
        userId: req.user!.id,
        documentId: req.params.documentId,
      })
      sendSuccess(res, 'Document deleted', result)
    } catch (err) {
      next(err)
    }
  },
)

router.delete(
  '/',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { documentIds } = req.body as { documentIds?: string[] }
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        sendError(res, 'documentIds must be a non-empty array', 400)
        return
      }
      const result = await bulkDeleteDocuments({
        userId: req.user!.id,
        documentIds,
      })
      sendSuccess(res, 'Documents deleted', result)
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/multipart/:uploadId/abort',
  authMiddleware,
  requireAuth,
  validate(abortMultipartSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body
      await abortMultipart({
        userId: req.user!.id,
        documentId: body.documentId,
        applicationId: body.applicationId,
        fileName: body.fileName,
        uploadId: body.uploadId,
      })
      sendSuccess(res, 'Multipart upload aborted')
    } catch (err) {
      next(err)
    }
  },
)

router.get(
  '/multipart/:uploadId/parts',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId, documentId, fileName } = req.query as {
        applicationId?: string
        documentId?: string
        fileName?: string
      }
      if (!applicationId || !documentId || !fileName) {
        sendError(res, 'applicationId, documentId and fileName are required', 400)
        return
      }
      const partNumbers = await listUploadedParts({
        userId: req.user!.id,
        applicationId,
        documentId,
        fileName,
        uploadId: req.params.uploadId,
      })
      sendSuccess(res, 'Uploaded parts', { partNumbers })
    } catch (err) {
      next(err)
    }
  },
)

export const documentsRouter = router

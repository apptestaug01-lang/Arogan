import { Router, Response, NextFunction } from 'express'
import { authMiddleware, requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validateRequest.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { presignDocument, completeDocument } from '../services/document.service.js'
import {
  presignMultipart,
  completeMultipart,
  abortMultipart,
  listUploadedParts,
} from '../services/multipart.service.js'
import {
  documentPresignSchema,
  documentCompleteSchema,
  completeMultipartSchema,
  abortMultipartSchema,
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
        category: body.category,
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
        category: body.category,
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
        category: body.category,
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
        category: body.category,
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

import { Router, Response, NextFunction } from 'express'
import { authMiddleware, requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validateRequest.js'
import { sendSuccess } from '../utils/response.js'
import { presignDocument, completeDocument } from '../services/document.service.js'
import { documentPresignSchema, documentCompleteSchema } from '../utils/validation.js'

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

export const documentsRouter = router

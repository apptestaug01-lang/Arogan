import { Router, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import {
  createApplication,
  updateApplication,
  getApplication,
  listApplications,
} from '../services/application.service.js'
import { authMiddleware, requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validateRequest.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { createApplicationSchema, updateApplicationSchema, getApplicationSchema } from '../utils/applicationValidation.js'

const router = Router()

router.get(
  '/applications',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const applications = await listApplications(req.user!.id)
      sendSuccess(res, 'Applications listed', { applications })
    } catch (err) {
      next(err)
    }
  },
)

router.get(
  '/applications/:applicationId',
  authMiddleware,
  requireAuth,
  validate(getApplicationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const application = await getApplication(req.user!.id, req.params.applicationId)
      if (!application) {
        sendError(res, 'Application not found', 404)
        return
      }
      sendSuccess(res, 'Application found', { application })
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/applications',
  authMiddleware,
  requireAuth,
  validate(createApplicationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body
      const application = await createApplication({
        userId: req.user!.id,
        applicationId: body.applicationId,
        data: body.data,
        status: body.status,
      })
      sendSuccess(res, 'Application created', { application }, 201)
    } catch (err) {
      next(err)
    }
  },
)

router.patch(
  '/applications/:applicationId',
  authMiddleware,
  requireAuth,
  validate(updateApplicationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body
      const application = await updateApplication({
        userId: req.user!.id,
        applicationId: req.params.applicationId,
        data: body.data,
        status: body.status,
      })
      sendSuccess(res, 'Application updated', { application })
    } catch (err) {
      next(err)
    }
  },
)

export { router as applicationsRouter }

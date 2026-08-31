import { Router, Response, NextFunction } from 'express'
import {
  createApplication,
  updateApplication,
  getApplication,
  listApplications,
  submitApplication,
} from '../services/application.service.js'
import { authMiddleware, requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validateRequest.js'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  createApplicationSchema,
  updateApplicationSchema,
  getApplicationSchema,
} from '../utils/applicationValidation.js'
import {
  WIZARD_INDUSTRIES,
  WIZARD_BUSINESS_TYPES,
  WIZARD_PRODUCT_TYPES,
  WIZARD_STATEMENT_PERIODS,
  WIZARD_ASSESSMENT_YEARS,
} from '../utils/constants.js'
import { extractWithLlm } from '../services/llm.service.js'
import { extractWithAzureMultiModel } from '../services/azureDocument.service.js'

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

router.get(
  '/constants',
  authMiddleware,
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, 'Wizard constants', {
        industries: WIZARD_INDUSTRIES,
        businessTypes: WIZARD_BUSINESS_TYPES,
        productTypes: WIZARD_PRODUCT_TYPES,
        statementPeriods: WIZARD_STATEMENT_PERIODS,
        assessmentYears: WIZARD_ASSESSMENT_YEARS,
      })
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/applications/:applicationId/submit',
  authMiddleware,
  requireAuth,
  validate(getApplicationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const application = await submitApplication(req.user!.id, req.params.applicationId)
      sendSuccess(res, 'Application submitted', { application })
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/applications/llm-extract',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text, fields } = req.body as { text: string; fields: string[] };
      if (!text || !fields?.length) {
        sendError(res, 'text and fields are required', 400);
        return;
      }
      const results = await extractWithLlm(text, fields);
      sendSuccess(res, 'LLM extraction complete', { results });
    } catch (err) {
      next(err);
    }
  },
)

router.post(
  '/applications/azure-extract',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { documents } = req.body as { documents: Array<{ url: string; contentType: string; fileName: string }> };
      if (!documents?.length) {
        sendError(res, 'documents array is required', 400);
        return;
      }
      const results = await extractWithAzureMultiModel(documents);
      sendSuccess(res, 'Azure extraction complete', { results });
    } catch (err) {
      next(err);
    }
  },
)

export { router as applicationsRouter }

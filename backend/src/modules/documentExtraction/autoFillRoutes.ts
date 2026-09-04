import { Router, Response, NextFunction } from 'express';
import { AutoFillService } from './autoFillService.js';
import { WizardStep } from './types.js';
import { authMiddleware, requireAuth, AuthenticatedRequest } from '../../middleware/authMiddleware.js';

const router = Router();

const autoFillService = new AutoFillService();

const VALID_STEPS: WizardStep[] = ['kyc', 'business', 'financials', 'loan'];

router.post(
  '/:applicationId/extract-all',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const force = req.query.force === 'true' || req.query.force === '1';
      const result = await autoFillService.extractAllDocuments(req.user!.id, applicationId, { force });
      res.setHeader('X-Extraction-Status', result.cacheStatus);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:applicationId/autofill',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { step, documentIds } = req.body;
      const force = req.query.force === 'true' || req.query.force === '1';

      if (!step || !VALID_STEPS.includes(step)) {
        res.status(400).json({
          success: false,
          message: 'Invalid step. Must be one of: kyc, business, financials, loan',
        });
        return;
      }

      const { data, cacheStatus } = await autoFillService.autoFillStep(
        req.user!.id,
        applicationId,
        step,
        documentIds,
        { force },
      );

      res.setHeader('X-Extraction-Status', cacheStatus);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:applicationId/extract/:documentId',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId, documentId } = req.params;
      const force = req.query.force === 'true' || req.query.force === '1';
      const fields = await autoFillService.extractFromDocument(req.user!.id, documentId, { force });
      if (!fields) {
        res.status(404).json({ success: false, message: 'Document not found or extraction unavailable' });
        return;
      }
      res.json({
        success: true,
        data: {
          documentId,
          applicationId,
          fields,
          fieldCount: Object.keys(fields).length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:applicationId/autofill/status',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { prisma } = await import('../../lib/prisma.js');
      const documents = await prisma.document.findMany({
        where: {
          userId: req.user!.id,
          applicationId: req.params.applicationId,
          status: { not: 'DELETED' },
        },
        select: {
          id: true,
          originalName: true,
          contentType: true,
          createdAt: true,
        },
      });

      const documentIds = documents.map((d) => d.id);
      const extractions = documentIds.length
        ? await prisma.documentExtraction.findMany({
            where: { documentId: { in: documentIds } },
            select: {
              documentId: true,
              status: true,
              documentType: true,
              modelUsed: true,
              error: true,
              extractedAt: true,
              updatedAt: true,
            },
          })
        : [];
      const extractionByDoc = new Map(extractions.map((e) => [e.documentId, e]));

      res.json({
        success: true,
        data: {
          applicationId: req.params.applicationId,
          documents: documents.map((d) => ({
            ...d,
            extraction: extractionByDoc.get(d.id) ?? null,
          })),
          totalDocuments: documents.length,
          extractedCount: extractions.filter((e) => e.status === 'completed').length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

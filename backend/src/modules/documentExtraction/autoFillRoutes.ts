import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AutoFillService } from './autoFillService.js';
import { WizardStep } from './types.js';

const prisma = new PrismaClient();
const router = Router();

const autoFillService = new AutoFillService();

const VALID_STEPS: WizardStep[] = ['kyc', 'business', 'financials', 'loan'];

const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as Request & { userId: string }).userId = userId;
  next();
};

router.post(
  '/:applicationId/autofill',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as Request & { userId: string }).userId;
      const { applicationId } = req.params;
      const { step, documentIds } = req.body;

      if (!step || !VALID_STEPS.includes(step)) {
        res.status(400).json({
          error: 'Invalid step. Must be one of: kyc, business, financials, loan',
        });
        return;
      }

      const application = await prisma.application.findFirst({
        where: { id: applicationId, userId },
      });

      if (!application) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      const result = await autoFillService.autoFillStep(
        userId,
        applicationId,
        step,
        documentIds,
      );

      res.json(result);
    } catch (error) {
      console.error('Auto-fill error:', error);
      res.status(500).json({ error: 'Auto-fill processing failed' });
    }
  },
);

router.get(
  '/:applicationId/autofill/status',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as Request & { userId: string }).userId;
      const { applicationId } = req.params;

      const documents = await prisma.document.findMany({
        where: { userId, applicationId, status: { not: 'DELETED' } },
        select: {
          id: true,
          originalName: true,
          contentType: true,
          createdAt: true,
        },
      });

      res.json({
        applicationId,
        documents,
        totalDocuments: documents.length,
      });
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  },
);

router.post(
  '/documents/:documentId/extract',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as Request & { userId: string }).userId;
      const { documentId } = req.params;

      const result = await autoFillService.extractFromDocument(userId, documentId);

      if (!result) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Extraction error:', error);
      res.status(500).json({ error: 'Document extraction failed' });
    }
  },
);

export default router;

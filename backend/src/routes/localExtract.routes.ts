import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import { LocalExtractService } from '../services/local-extract/index.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.tiff', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

/**
 * POST /api/local-extract/single
 * Extract KYC data from a single uploaded file
 */
router.post(
  '/single',
  upload.single('document'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        sendError(res, 'No file uploaded', 400);
        return;
      }

      const service = new LocalExtractService({ debug: req.query.debug === 'true' });
      const result = await service.extractFromBuffer(req.file.buffer, req.file.originalname);

      if (!result.success) {
        sendError(res, result.errors.join('; '), 422);
        return;
      }

      sendSuccess(res, 'Extraction complete', { result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/local-extract/batch
 * Extract KYC data from multiple uploaded files
 */
router.post(
  '/batch',
  upload.array('documents', 20),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        sendError(res, 'No files uploaded', 400);
        return;
      }

      const service = new LocalExtractService({ debug: req.query.debug === 'true' });
      const results = [];

      for (const file of files) {
        const result = await service.extractFromBuffer(file.buffer, file.originalname);
        results.push(result);
      }

      // Merge results
      const merged = service.mergeResults(results);

      sendSuccess(res, 'Batch extraction complete', {
        results,
        merged,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/local-extract/merge
 * Merge extraction results from multiple documents
 */
router.post(
  '/merge',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { results } = req.body as { results: any[] };
      if (!results || !Array.isArray(results)) {
        sendError(res, 'results array is required', 400);
        return;
      }

      const service = new LocalExtractService();
      const merged = service.mergeResults(results);

      sendSuccess(res, 'Results merged', { merged });
    } catch (err) {
      next(err);
    }
  },
);

export { router as localExtractRouter };

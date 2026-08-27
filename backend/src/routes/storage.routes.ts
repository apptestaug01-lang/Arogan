import { Router, Request, Response, NextFunction } from 'express'
import { checkStorageHealth } from '../services/storage.service.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { getStorageConfig } from '../config/storage.config.js'

const router = Router()

router.get('/health', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ok = await checkStorageHealth()
    if (ok) {
      sendSuccess(res, 'Storage healthy', { bucket: getStorageConfig().bucket })
      return
    }
    sendError(res, 'Storage backend is unavailable', 503)
  } catch (err) {
    next(err)
  }
})

export const storageRouter = router

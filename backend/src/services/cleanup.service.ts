import { prisma } from '../lib/prisma.js';
import logger from '../middleware/logger.js';
import { validateEnv } from '../utils/env.validation.js';

const env = validateEnv();

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupJob(): void {
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('Session/OTP cleanup job started (non-production)');
  }

  cleanup();

  const intervalMs = env.SESSION_CLEANUP_INTERVAL_MS;
  cleanupInterval = setInterval(() => {
    cleanup().catch((err) => {
      logger.error({ err: { message: err.message, stack: err.stack } }, 'Cleanup job failed');
    });
  }, intervalMs);

  logger.info(`Scheduled session/OTP cleanup every ${intervalMs / 1000}s`);
}

async function cleanup(): Promise<void> {
  const now = new Date();

  const [sessionsResult, otpsResult] = await Promise.allSettled([
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revoked: true, expiresAt: { lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
    prisma.oTPRequest.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { used: true }],
      },
    }),
  ]);

  const sessionsDeleted = sessionsResult.status === 'fulfilled' ? sessionsResult.value.count : 0;
  const otpsDeleted = otpsResult.status === 'fulfilled' ? otpsResult.value.count : 0;

  logger.info(`Cleanup: removed ${sessionsDeleted} expired sessions, ${otpsDeleted} expired/used OTPs`);
}

export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

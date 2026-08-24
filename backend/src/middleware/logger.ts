import os from 'os';
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      nodeVersion: process.version,
    }),
  },
  base: {
    pid: process.pid,
    hostname: os.hostname(),
  },
});

export function logRequest(
  method: string,
  url: string,
  statusCode: number,
  durationMs: number,
  ip?: string,
  userAgent?: string,
): void {
  logger.info(
    {
      method,
      url,
      statusCode,
      durationMs,
      ip,
      userAgent,
    },
    `${method} ${url} ${statusCode} - ${durationMs}ms`,
  );
}

export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error({ err: { message: error.message, stack: error.stack }, ...context });
}

export function logAudit(action: string, details?: Record<string, unknown>): void {
  logger.info({ action, ...details }, `AUDIT: ${action}`);
}

export default logger;

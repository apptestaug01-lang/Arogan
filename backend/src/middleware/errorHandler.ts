import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from './logger.js';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const formatted = err.errors.map((e) => ({
      field: e.path.join('.') || 'body',
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatted,
    });
    return;
  }

  const error = err as ApiError;
  const statusCode = error.statusCode || 500;
  const isOperational = Boolean(error.isOperational);

  if (!isOperational) {
    const detail = error instanceof Error ? error.stack || error.message : String(err);
    if (process.env.NODE_ENV === 'production') {
      console.error('[UNEXPECTED_ERROR]', detail);
    }
    logger.error({ err: detail }, 'Non-operational error encountered');
  }

  const message = isOperational ? error.message : 'Something went wrong';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
}

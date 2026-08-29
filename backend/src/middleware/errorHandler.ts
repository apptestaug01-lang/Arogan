import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from './logger.js';
import { ApiError } from '../utils/errors.js';

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

  if (err instanceof Error && 'code' in err) {
    const code = (err as any).code
    if (code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'A record with this value already exists. Please use a different value.',
      });
      return;
    }
    if (code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found',
      });
      return;
    }
    if (code === 'P1001' || code === 'P1002' || code === 'P1003') {
      res.status(503).json({
        success: false,
        message: 'Database is temporarily unavailable. Please try again.',
      });
      return;
    }
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

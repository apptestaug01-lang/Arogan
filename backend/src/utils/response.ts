import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200,
): void {
  res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: unknown[],
): void {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}

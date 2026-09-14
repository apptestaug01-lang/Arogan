import { Response } from 'express';

function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]),
    )
  }
  return value
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200,
): void {
  res.status(statusCode).json({
    success: true,
    message,
    data: data == null ? null : toJsonSafe(data),
  })
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

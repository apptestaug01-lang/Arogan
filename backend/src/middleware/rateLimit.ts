import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

export function createRateLimiter(
  windowMs: number,
  max: number,
  message: string,
) {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export function authRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const limiter = createRateLimiter(
    Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    Number(process.env.RATE_LIMIT_MAX) || 5,
    'Too many authentication attempts, please try again later.',
  );
  limiter(req, res, next);
}

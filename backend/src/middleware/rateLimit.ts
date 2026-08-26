import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

export function createRateLimiter(windowMs: number, max: number, message: string) {
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

const authLimiter = createRateLimiter(
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  Number(process.env.RATE_LIMIT_MAX) || 5,
  'Too many authentication attempts, please try again later.',
);

const otpVerifyLimiter = createRateLimiter(
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  Number(process.env.RATE_LIMIT_MAX_OTP_VERIFY) || 10,
  'Too many OTP verification attempts, please try again later.',
);

export function authRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  authLimiter(req, res, next);
}

export function otpVerifyRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  otpVerifyLimiter(req, res, next);
}

import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validateRequest.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { authMiddleware, requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess } from '../utils/response.js';
import { logAuditEvent } from '../services/audit.service.js';
import {
  signup,
  loginWithPassword,
  requestOtp,
  verifyOtpAndLogin,
  logout,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword as resetPasswordService,
} from '../services/auth.service.js';
import {
  sendWelcomeEmail,
  sendLoginNotificationEmail,
} from '../services/email.service.js';
import {
  signupSchema,
  loginPasswordSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validation.js';

const router = Router();

router.post(
  '/signup',
  authRateLimiter,
  validate(signupSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await signup(req.body);
      await logAuditEvent(
        'SIGNUP',
        req.ip,
        req.get('user-agent'),
        result.user.id,
      );
      await sendWelcomeEmail(result.user.email, result.user.fullName);
      sendSuccess(res, 'Account created successfully', { user: result.user }, 201);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login/password',
  authRateLimiter,
  validate(loginPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, ...tokens } = await loginWithPassword(req.body);
      await logAuditEvent('LOGIN_SUCCESS', req.ip, req.get('user-agent'));
      await sendLoginNotificationEmail(user.email, user.fullName, req.ip, req.get('user-agent') || undefined);

      res
        .cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .cookie('accessToken', tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
        });

      sendSuccess(res, 'Login successful', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login/otp/request',
  authRateLimiter,
  validate(otpRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await requestOtp(req.body);
      await logAuditEvent('OTP_REQUEST', req.ip, req.get('user-agent'));
      sendSuccess(res, result.message, result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login/otp/verify',
  authRateLimiter,
  validate(otpVerifySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, ...tokens } = await verifyOtpAndLogin(req.body);
      await logAuditEvent('OTP_LOGIN_SUCCESS', req.ip, req.get('user-agent'), user.id);
      await sendLoginNotificationEmail(user.email, user.fullName, req.ip, req.get('user-agent') || undefined);

      res
        .cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .cookie('accessToken', tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
        });

      sendSuccess(res, 'OTP verified and logged in', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/logout',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      if (refreshToken) {
        await logout(refreshToken);
      }
      await logAuditEvent('LOGOUT', req.ip, req.get('user-agent'), req.user?.id);

      res.clearCookie('refreshToken');
      res.clearCookie('accessToken');
      sendSuccess(res, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, ...tokens } = await refreshAccessToken(req.body.refreshToken);
      sendSuccess(res, 'Token refreshed', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/me',
  authMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    sendSuccess(res, 'User profile', { user: req.user });
  },
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await requestPasswordReset(req.body);
      await logAuditEvent('PASSWORD_RESET_REQUEST', req.ip, req.get('user-agent'));
      sendSuccess(res, result.message, result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await resetPasswordService(req.body);
      await logAuditEvent('PASSWORD_RESET_SUCCESS', req.ip, req.get('user-agent'));
      sendSuccess(res, result.message, result);
    } catch (err) {
      next(err);
    }
  },
);

export const authRouter = router;

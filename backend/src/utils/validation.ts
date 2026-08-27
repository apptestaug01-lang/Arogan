import { z } from 'zod';
import { ALL_ROLES } from '../utils/constants.js';

const roleEnum = z.enum(ALL_ROLES);

export const signupSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(50, 'Full name must be at most 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Full name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string().email('Invalid email address'),
  mobile: z
    .string()
    .length(10, 'Mobile number must be exactly 10 digits')
    .regex(/^[6-9]\d{9}$/, 'Mobile number must start with 6, 7, 8, or 9')
    .optional()
    .or(z.literal('')),
  countryCode: z.string().default('+91'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[^A-Za-z\d]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
  role: roleEnum,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const documentPresignSchema = z.object({
  applicationId: z.string().min(1, 'Application id is required'),
  category: z.string().min(1).max(50),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1),
  contentLength: z.number().int().positive().max(5 * 1024 * 1024 * 1024),
});

export const documentCompleteSchema = z.object({
  applicationId: z.string().min(1, 'Application id is required'),
  category: z.string().min(1).max(50),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1),
});

export const loginPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile number is required'),
  password: z.string().min(1, 'Password is required'),
});

export const otpRequestSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile number is required'),
  channel: z.enum(['email', 'sms']),
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[^A-Za-z\d]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
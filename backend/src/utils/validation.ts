import { z } from 'zod';

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
  role: z.enum(['BORROWER', 'ADMIN', 'ANALYST', 'APPROVER']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const loginPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile number is required'),
  password: z.string().min(1, 'Password is required'),
});

export const otpRequestSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile number is required'),
  channel: z.enum(['email', 'sms'])
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const ROLES = {
  BORROWER: 'BORROWER',
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
  APPROVER: 'APPROVER',
} as const;

export const OTP_EXPIRY_SECONDS =
  Number(process.env.OTP_EXPIRY_SECONDS) || 60;

export const OTP_MAX_REQUESTS =
  Number(process.env.OTP_MAX_REQUESTS_PER_WINDOW) || 5;

export const OTP_WINDOW_MINUTES =
  Number(process.env.OTP_WINDOW_MINUTES) || 10;

export const MAX_FAILED_ATTEMPTS = Number(process.env.MAX_FAILED_ATTEMPTS) || 5;

export const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES) || 15;

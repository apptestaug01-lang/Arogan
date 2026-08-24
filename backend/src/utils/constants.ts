export const ALLOWED_SIGNUP_ROLES = ['BORROWER'] as const;
export type SignupRole = (typeof ALLOWED_SIGNUP_ROLES)[number];

export const ALL_ROLES = ['BORROWER', 'ADMIN', 'ANALYST', 'APPROVER'] as const;
export type AllRoles = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<AllRoles, string> = {
  BORROWER: 'Borrower',
  ADMIN: 'Admin',
  ANALYST: 'Credit Analyst',
  APPROVER: 'Credit Approver',
};

export function isRoleAllowedForSignup(role: string): role is SignupRole {
  return ALLOWED_SIGNUP_ROLES.includes(role as SignupRole);
}

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

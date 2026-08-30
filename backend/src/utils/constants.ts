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

export const OTP_RESEND_COOLDOWN_SECONDS =
  Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60;

export const MAX_FAILED_ATTEMPTS = Number(process.env.MAX_FAILED_ATTEMPTS) || 5;

export const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES) || 15;

// Document upload (Chunk B)
export const ALLOWED_DOCUMENT_CONTENT_TYPES: string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB (S3 single-PUT ceiling)
export const PRESIGNED_UPLOAD_TTL_SECONDS = 15 * 60; // 15 minutes
export const PRESIGNED_DOWNLOAD_TTL_SECONDS = 5 * 60; // 5 minutes (viewer links)

// Multipart upload (Chunk C) — >100 MB chunking strategy
export const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB
export const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024; // 64 MB per part
export const MULTIPART_CONCURRENCY = 4; // parallel part uploads
export const MULTIPART_MAX_PARTS = 10000; // S3 hard ceiling
export const MULTIPART_ABORT_DAYS = 7; // lifecycle cleanup for orphaned uploads

// Wizard constants (fetched by frontend to avoid hardcoded values)
export const WIZARD_INDUSTRIES = [
  'Infrastructure',
  'Manufacturing',
  'Renewable Energy',
  'IT/ITES',
  'Others',
] as const;

export const WIZARD_BUSINESS_TYPES = [
  'Private Limited',
  'Public Limited',
  'LLP',
  'Proprietorship',
  'Partnership',
] as const;

export const WIZARD_PRODUCT_TYPES = [
  'Term Loan',
  'Working Capital',
  'Project Finance',
  'LC/BG',
] as const;

export const WIZARD_STATEMENT_PERIODS = [
  '3 months',
  '6 months',
  '12 months',
] as const;

export const WIZARD_ASSESSMENT_YEARS = [
  'AY 2024-25',
  'AY 2023-24',
  'AY 2022-23',
] as const;

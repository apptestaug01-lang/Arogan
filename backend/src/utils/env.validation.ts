export interface ValidatedEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  BCRYPT_COST: number;
  OTP_EXPIRY_SECONDS: number;
  OTP_MAX_REQUESTS_PER_WINDOW: number;
  OTP_WINDOW_MINUTES: number;
  MAX_FAILED_ATTEMPTS: number;
  LOCKOUT_MINUTES: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
   CORS_ORIGIN: string;
  FRONTEND_URL: string;
   BREVO_API_KEY: string;
  BREVO_FROM_EMAIL: string;
  BREVO_FROM_NAME: string;
  BREVO_REPLY_TO: string;
  SESSION_CLEANUP_INTERVAL_MS: number;
  HF_API_KEY: string;
  OLLAMA_URL: string;
  OLLAMA_MODEL: string;
}

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGIN',
] as const;

const criticalSecrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

export function validateEnv(): ValidatedEnv {
  const errors: string[] = [];

  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  for (const secret of criticalSecrets) {
    const value = process.env[secret];
    if (value && value.includes('change-this')) {
      errors.push(
        `Environment variable ${secret} is using a default insecure value. ` +
          'Generate a secure random secret for production.',
      );
    }
  }

  if (errors.length > 0) {
    const message = `Environment validation failed:\n  - ${errors.join('\n  - ')}`;
    console.error(message);
    process.exit(1);
  }

  return {
    NODE_ENV: (process.env.NODE_ENV as ValidatedEnv['NODE_ENV']) || 'development',
    PORT: Number(process.env.PORT) || 4000,
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    BCRYPT_COST: Number(process.env.BCRYPT_COST) || 12,
    OTP_EXPIRY_SECONDS: Number(process.env.OTP_EXPIRY_SECONDS) || 60,
    OTP_MAX_REQUESTS_PER_WINDOW: Number(process.env.OTP_MAX_REQUESTS_PER_WINDOW) || 5,
    OTP_WINDOW_MINUTES: Number(process.env.OTP_WINDOW_MINUTES) || 10,
    MAX_FAILED_ATTEMPTS: Number(process.env.MAX_FAILED_ATTEMPTS) || 5,
    LOCKOUT_MINUTES: Number(process.env.LOCKOUT_MINUTES) || 15,
    RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 5,
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    BREVO_API_KEY: process.env.BREVO_API_KEY || '',
    BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL || 'no-reply@loanflow.app',
    BREVO_FROM_NAME: process.env.BREVO_FROM_NAME || 'LoanFlow',
    BREVO_REPLY_TO: process.env.BREVO_REPLY_TO || process.env.BREVO_FROM_EMAIL || 'no-reply@loanflow.app',
    SESSION_CLEANUP_INTERVAL_MS: Number(process.env.SESSION_CLEANUP_INTERVAL_MS) || 3_600_000,
    HF_API_KEY: process.env.HF_API_KEY || '',
    OLLAMA_URL: process.env.OLLAMA_URL || '',
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3.2:1b',
  };
}

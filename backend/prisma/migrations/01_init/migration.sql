-- prisma migrate dev was run here, creating this migration
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT '+91',
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'BORROWER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lockedUntil" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
CREATE INDEX "User_mobile_countryCode_key" ON "User" ("mobile", "countryCode");

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session" ("refreshToken");
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");

CREATE TABLE "OTPRequest" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OTPRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OTPRequest_identifier_idx" ON "OTPRequest" ("identifier");
CREATE INDEX "OTPRequest_expiresAt_idx" ON "OTPRequest" ("expiresAt");
CREATE INDEX "OTPRequest_createdAt_idx" ON "OTPRequest" ("createdAt");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog" ("userId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog" ("timestamp");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog" ("action");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create enum type for Role
CREATE TYPE "Role" AS ENUM ('BORROWER', 'ADMIN', 'ANALYST', 'APPROVER');

-- Create enum type for OtpChannel
CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'SMS');

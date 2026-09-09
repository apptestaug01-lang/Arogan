-- ============================================================
-- Database Cleanup Script
-- Deletes all data in FK-safe order (child tables first).
-- Run with: psql $DATABASE_URL -f cleanup.sql
-- Or via Prisma: npx prisma db execute --stdin --schema prisma/schema.prisma < cleanup.sql
-- ============================================================

BEGIN;

-- 1. Derived/document child tables (CASCADE from Document)
DELETE FROM "DocumentArchive";
DELETE FROM "DocumentExtraction";

-- 2. Documents (FK to User and Application)
DELETE FROM "Document";

-- 3. Applications (FK to User)
DELETE FROM "Application";

-- 4. Sessions (CASCADE from User)
DELETE FROM "Session";

-- 5. Audit logs (SET NULL on User delete)
DELETE FROM "AuditLog";

-- 6. OTP requests (no FK)
DELETE FROM "OTPRequest";

-- 7. Users (parent)
DELETE FROM "User";

COMMIT;

-- ============================================================
-- Alternative: full truncate with cascade (resets sequences too)
-- Uncomment below and comment out the DELETE block above if you
-- want a hard reset including sequence values.
-- ============================================================
-- TRUNCATE TABLE
--   "DocumentArchive",
--   "DocumentExtraction",
--   "Document",
--   "Application",
--   "Session",
--   "AuditLog",
--   "OTPRequest",
--   "User"
-- RESTART IDENTITY CASCADE;

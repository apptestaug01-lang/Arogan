import { prisma } from '../lib/prisma.js';

export async function logAuditEvent(
  action: string,
  ipAddress?: string,
  userAgent?: string,
  userId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      userId: userId || undefined,
      details: details as any,
    },
  });
}

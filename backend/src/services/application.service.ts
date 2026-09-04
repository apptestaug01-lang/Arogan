import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { logAuditEvent } from './audit.service.js'

const applicationPrisma = (prisma as any).application

export interface CreateApplicationInput {
  userId: string
  applicationId?: string
  data: Record<string, any>
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
}

export interface UpdateApplicationInput {
  userId: string
  applicationId: string
  data?: Record<string, any>
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
}

export interface ApplicationSummary {
  id: string
  applicationId: string
  status: string
  data: Record<string, any>
  version: number
  submittedAt?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export async function submitApplication(
  userId: string,
  applicationId: string,
): Promise<ApplicationSummary> {
  // Atomically transition DRAFT -> SUBMITTED and bump version + stamp
  // submittedAt. We use a transaction so concurrent submits cannot
  // double-increment the version.
  const application = await prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: { userId, applicationId },
    });
    if (!existing) {
      throw new Error('Application not found');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'SUBMITTED') {
      throw new Error(`Cannot submit application in status ${existing.status}`);
    }
    return tx.application.update({
      where: { id: existing.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
  });

  await logAuditEvent('APPLICATION_SUBMITTED', undefined, undefined, userId, {
    applicationId: application.applicationId,
    status: application.status,
    version: application.version,
  });

  return toSummary(application);
}

export async function resubmitApplication(
  userId: string,
  applicationId: string,
): Promise<ApplicationSummary> {
  // Re-submit on an already SUBMITTED app. Bumps version, leaves status
  // SUBMITTED, refreshes submittedAt. The caller should have already
  // written the new data via PATCH /:id.
  const application = await prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: { userId, applicationId },
    });
    if (!existing) {
      throw new Error('Application not found');
    }
    if (existing.status !== 'SUBMITTED') {
      throw new Error('Only submitted applications can be re-submitted');
    }
    return tx.application.update({
      where: { id: existing.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
  });

  await logAuditEvent('APPLICATION_RESUBMITTED', undefined, undefined, userId, {
    applicationId: application.applicationId,
    status: application.status,
    version: application.version,
  });

  return toSummary(application);
}

export async function createApplication(input: CreateApplicationInput): Promise<ApplicationSummary> {
  const appId = input.applicationId || `LAP-${Date.now()}-${randomUUID().slice(0, 8)}`
  const application = await applicationPrisma.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      applicationId: appId,
      data: input.data,
      status: input.status || 'DRAFT',
      submittedAt: input.status === 'SUBMITTED' ? new Date() : null,
    },
  })

  await logAuditEvent('APPLICATION_CREATED', undefined, undefined, input.userId, {
    applicationId: appId,
    status: application.status,
  })

  return toSummary(application)
}

export async function updateApplication(input: UpdateApplicationInput): Promise<ApplicationSummary> {
  const updateData: any = { data: input.data }
  if (input.status) {
    updateData.status = input.status
    if (input.status === 'SUBMITTED') updateData.submittedAt = new Date()
    if (input.status === 'UNDER_REVIEW') updateData.reviewedAt = new Date()
  }

  const existing = await applicationPrisma.findFirst({
    where: { userId: input.userId, applicationId: input.applicationId },
  })
  if (!existing) {
    throw new Error('Application not found')
  }

  const application = await applicationPrisma.update({
    where: { id: existing.id },
    data: updateData,
  })

  await logAuditEvent('APPLICATION_UPDATED', undefined, undefined, input.userId, {
    applicationId: input.applicationId,
    status: application.status,
  })

  return toSummary(application)
}

export async function getApplication(userId: string, applicationId: string): Promise<ApplicationSummary | null> {
  const application = await applicationPrisma.findFirst({
    where: { userId, applicationId },
  })

  if (!application) return null
  return toSummary(application)
}

export async function listApplications(userId: string): Promise<ApplicationSummary[]> {
  const applications = await applicationPrisma.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return applications.map((a: any) => toSummary(a))
}

function toSummary(a: any): ApplicationSummary {
  return {
    id: a.id,
    applicationId: a.applicationId,
    status: a.status,
    data: (a.data as Record<string, any>) ?? {},
    version: typeof a.version === 'number' ? a.version : 0,
    submittedAt: a.submittedAt?.toISOString(),
    reviewedAt: a.reviewedAt?.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

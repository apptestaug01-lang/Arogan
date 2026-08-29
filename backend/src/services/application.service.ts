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
  submittedAt?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
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

  return {
    id: application.id,
    applicationId: application.applicationId,
    status: application.status,
    data: application.data as Record<string, any>,
    submittedAt: application.submittedAt?.toISOString(),
    reviewedAt: application.reviewedAt?.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  }
}

export async function updateApplication(input: UpdateApplicationInput): Promise<ApplicationSummary> {
  const updateData: any = { data: input.data }
  if (input.status) {
    updateData.status = input.status
    if (input.status === 'SUBMITTED') updateData.submittedAt = new Date()
    if (input.status === 'UNDER_REVIEW') updateData.reviewedAt = new Date()
  }

  const application = await applicationPrisma.update({
    where: { applicationId: input.applicationId },
    data: updateData,
  })

  await logAuditEvent('APPLICATION_UPDATED', undefined, undefined, input.userId, {
    applicationId: input.applicationId,
    status: application.status,
  })

  return {
    id: application.id,
    applicationId: application.applicationId,
    status: application.status,
    data: application.data as Record<string, any>,
    submittedAt: application.submittedAt?.toISOString(),
    reviewedAt: application.reviewedAt?.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  }
}

export async function getApplication(userId: string, applicationId: string): Promise<ApplicationSummary | null> {
  const application = await applicationPrisma.findFirst({
    where: { userId, applicationId },
  })

  if (!application) return null

  return {
    id: application.id,
    applicationId: application.applicationId,
    status: application.status,
    data: application.data as Record<string, any>,
    submittedAt: application.submittedAt?.toISOString(),
    reviewedAt: application.reviewedAt?.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  }
}

export async function listApplications(userId: string): Promise<ApplicationSummary[]> {
  const applications = await applicationPrisma.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return applications.map((a: any) => ({
    id: a.id,
    applicationId: a.applicationId,
    status: a.status,
    data: a.data as Record<string, any>,
    submittedAt: a.submittedAt?.toISOString(),
    reviewedAt: a.reviewedAt?.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }))
}

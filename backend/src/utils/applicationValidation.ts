import { z } from 'zod'
import { ApiError } from '../utils/errors.js'

export const createApplicationSchema = z.object({
  applicationId: z.string().min(1).max(100).optional(),
  data: z.record(z.string(), z.any()),
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
});

export const updateApplicationSchema = z.object({
  applicationId: z.string().min(1).max(100),
  data: z.record(z.string(), z.any()).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
});

export const getApplicationSchema = z.object({
  applicationId: z.string().min(1).max(100),
});

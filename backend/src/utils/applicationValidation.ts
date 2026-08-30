import { z } from 'zod'

export const createApplicationSchema = z.object({
  applicationId: z.string().min(1).max(100).optional(),
  data: z.object({
    fullName: z.string().min(2),
    pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/),
    aadhaar: z.string().regex(/^[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}$/),
    email: z.string().email(),
    mobile: z.string().regex(/^\+?[0-9\s]{10,15}$/),
    address: z.string().min(10),
    companyName: z.string().min(2),
    cin: z.string().min(1),
    businessType: z.string().min(1),
    industry: z.string().min(1),
    gstRegistered: z.boolean().default(false),
    gstin: z.string().optional(),
    companyPan: z.string().optional(),
    dateOfIncorporation: z.string().date().optional(),
    itrYears: z.array(z.string()).min(2).max(2),
    itrFiled: z.array(z.boolean()).min(2).max(2),
    turnover: z.array(z.number().positive()).min(2).max(2),
    profit: z.array(z.number()).min(2).max(2),
    bankStatementPeriod: z.string().min(1),
    avgMonthlyBalance: z.string().min(1),
    chequeBounces: z.number().nonnegative().default(0),
    existingMonthlyEmi: z.string().min(1),
    avgMonthlyCredits: z.string().min(1),
    netWorth: z.number().min(0),
    existingDebt: z.number().min(0),
    loanAmount: z.number().positive().max(500),
    productType: z.string().min(1),
    tenor: z.number().int().positive().max(25),
    interestRate: z.number().positive().max(30).optional(),
    purpose: z.string().min(20),
    collateral: z.string().min(20),
  }),
  status: z.enum(['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED']).optional(),
});

export const updateApplicationSchema = z.object({
  applicationId: z.string().min(1).max(100),
  data: z.record(z.string(), z.any()).optional(),
  status: z.enum(['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED']).optional(),
});

export const getApplicationSchema = z.object({
  applicationId: z.string().min(1).max(100),
});

import api from './api';

export interface ApplicationSummary {
  id: string;
  applicationId: string;
  status: string;
  data: Record<string, unknown>;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WizardConstants {
  industries: string[];
  businessTypes: string[];
  productTypes: string[];
  statementPeriods: string[];
  assessmentYears: string[];
}

export interface CreateApplicationInput {
  applicationId?: string;
  data: Record<string, unknown>;
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
}

export interface UpdateApplicationInput {
  applicationId: string;
  data?: Record<string, unknown>;
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
}

export async function createApplication(input: CreateApplicationInput): Promise<{ application: ApplicationSummary }> {
  const res = await api.post<{ data: { application: ApplicationSummary } }>('/applications', input);
  return res.data.data;
}

export async function updateApplication(input: UpdateApplicationInput): Promise<{ application: ApplicationSummary }> {
  const res = await api.patch<{ data: { application: ApplicationSummary } }>(`/applications/${input.applicationId}`, {
    data: input.data,
    status: input.status,
  });
  return res.data.data;
}

export async function getApplication(applicationId: string): Promise<{ application: ApplicationSummary }> {
  const res = await api.get<{ data: { application: ApplicationSummary } }>(`/applications/${applicationId}`);
  return res.data.data;
}

export async function listApplications(): Promise<{ applications: ApplicationSummary[] }> {
  const res = await api.get<{ data: { applications: ApplicationSummary[] } }>('/applications');
  return res.data.data;
}

export async function getWizardConstants(): Promise<WizardConstants> {
  const res = await api.get<{ data: WizardConstants }>('/applications/constants');
  return res.data.data;
}

export async function submitApplication(applicationId: string): Promise<{ application: ApplicationSummary }> {
  const res = await api.post<{ data: { application: ApplicationSummary } }>(`/applications/${applicationId}/submit`, {});
  return res.data.data;
}

export interface LlmExtractionResult {
  field: string;
  value: string;
  confidence: number;
  source: string;
}

export async function extractWithLlm(text: string, fields: string[]): Promise<LlmExtractionResult[]> {
  const res = await api.post<{ data: { results: LlmExtractionResult[] } }>('/applications/llm-extract', {
    text,
    fields,
  });
  return res.data.data.results;
}

export interface AzureDocumentInput {
  url: string;
  contentType: string;
  fileName: string;
}

export interface AzureExtractionResult {
  field: string;
  value: string;
  confidence: number;
  source: string;
}

export async function extractWithAzure(documents: AzureDocumentInput[]): Promise<AzureExtractionResult[]> {
  const res = await api.post<{ data: { results: AzureExtractionResult[] } }>('/applications/azure-extract', {
    documents,
  });
  return res.data.data.results;
}

import api from './api';

export interface ApplicationSummary {
  id: string;
  applicationId: string;
  status: string;
  data: Record<string, any>;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  applicationId?: string;
  data: Record<string, any>;
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
}

export interface UpdateApplicationInput {
  applicationId: string;
  data?: Record<string, any>;
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

import api from './api';
import type { CacheStatus } from './autoFill';

export interface ApplicationDocument {
  id: string;
  originalName: string;
  contentType: string;
  size: number | null;
  status: string;
  createdAt: string;
  extraction: {
    documentId: string;
    documentType: string;
    status: string;
    modelUsed: string | null;
    error: string | null;
    extractedAt: string;
    updatedAt: string;
  } | null;
}

export interface ApplicationDocumentsResponse {
  applicationId: string;
  documents: ApplicationDocument[];
  totalDocuments: number;
  extractedCount: number;
  cacheStatus: CacheStatus;
}

export async function listApplicationDocuments(applicationId: string): Promise<ApplicationDocumentsResponse> {
  const res = await api.get<{ data: ApplicationDocumentsResponse }>(
    `/applications/${applicationId}/autofill/status`,
  );
  return res.data.data;
}

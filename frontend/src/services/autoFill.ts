import api from './api';

export interface ExtractedField {
  value: string | number | boolean | string[];
  confidence: number;
  source: string;
  page?: number;
  raw?: string;
}

export type CacheStatus = 'cached' | 'live' | 'mixed';

export interface AutoFillResult {
  step: 'kyc' | 'business' | 'financials' | 'loan';
  extractedFields: Record<string, ExtractedField>;
  unmatchedDocuments: string[];
  missingFields: string[];
}

export interface ExtractAllResult {
  documents: Array<{
    documentId: string;
    fileName: string;
    documentType: string;
    status: 'processing' | 'completed' | 'error';
    modelUsed?: string;
    error?: string;
  }>;
  extractedFields: Record<string, ExtractedField>;
  fieldsByStep: Record<string, Record<string, ExtractedField>>;
  totalDocuments: number;
  processedDocuments: number;
  cacheStatus: CacheStatus;
}

export interface AutoFillResponse {
  data: AutoFillResult;
  cacheStatus: CacheStatus;
}

export async function extractAllDocuments(applicationId: string, force = false): Promise<ExtractAllResult> {
  const res = await api.post(`/applications/${applicationId}/extract-all`, undefined, {
    params: force ? { force: 'true' } : undefined,
  });
  const cacheStatus = (res.headers['x-extraction-status'] as CacheStatus) ?? 'live';
  return { ...res.data.data, cacheStatus };
}

export async function extractOneDocument(
  applicationId: string,
  documentId: string,
  force = false,
): Promise<{ documentId: string; applicationId: string; fields: Record<string, ExtractedField>; fieldCount: number }> {
  const res = await api.post(
    `/applications/${applicationId}/extract/${documentId}`,
    undefined,
    { params: force ? { force: 'true' } : undefined },
  );
  return res.data.data;
}

export async function autoFillStep(
  applicationId: string,
  step: string,
  documentIds?: string[],
): Promise<AutoFillResponse> {
  const res = await api.post(`/applications/${applicationId}/autofill`, {
    step,
    documentIds,
  });
  const cacheStatus = (res.headers['x-extraction-status'] as CacheStatus) ?? 'live';
  return { data: res.data.data, cacheStatus };
}

export async function getAutoFillStatus(applicationId: string): Promise<{
  applicationId: string;
  documents: Array<{
    id: string;
    originalName: string;
    contentType: string;
    createdAt: string;
    extraction: {
      documentId: string;
      status: string;
      documentType: string;
      modelUsed: string | null;
      extractedAt: string;
      updatedAt: string;
    } | null;
  }>;
  totalDocuments: number;
  extractedCount: number;
}> {
  const { data } = await api.get(`/applications/${applicationId}/autofill/status`);
  return data.data;
}

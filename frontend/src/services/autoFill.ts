import api from './api';

export interface ExtractedField {
  value: string | number | boolean | string[];
  confidence: number;
  source: string;
  page?: number;
  raw?: string;
}

export interface AutoFillResult {
  step: 'kyc' | 'business' | 'financials' | 'loan';
  extractedFields: Record<string, ExtractedField>;
  unmatchedDocuments: string[];
  missingFields: string[];
}

export interface ExtractionResult {
  documentId: string;
  fileName: string;
  documentType: string;
  fields: Record<string, ExtractedField>;
  rawText: string;
}

export async function autoFillStep(
  applicationId: string,
  step: string,
  documentIds?: string[],
): Promise<AutoFillResult> {
  const { data } = await api.post(`/applications/${applicationId}/autofill`, {
    step,
    documentIds,
  });
  return data.data;
}

export async function getAutoFillStatus(
  applicationId: string,
): Promise<{
  applicationId: string;
  documents: Array<{
    id: string;
    originalName: string;
    contentType: string;
    createdAt: string;
  }>;
  totalDocuments: number;
}> {
  const { data } = await api.get(`/applications/${applicationId}/autofill/status`);
  return data.data;
}

export async function extractDocument(
  documentId: string,
): Promise<ExtractionResult> {
  const { data } = await api.post(`/documents/${documentId}/extract`);
  return data.data;
}

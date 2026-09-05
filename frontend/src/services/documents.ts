import api from './api';

export interface ExplorerEntry {
  name: string;
  type: 'folder' | 'file';
  key: string;
  size?: number;
  lastModified?: string;
  documentId?: string;
  status?: string;
}

export interface ExplorerResult {
  prefix: string;
  folders: ExplorerEntry[];
  files: ExplorerEntry[];
  nextToken: string | null;
}

export async function getExplorer(
  prefix?: string,
  continuation?: string,
): Promise<ExplorerResult> {
  const params: Record<string, string> = {};
  if (prefix) params.prefix = prefix;
  if (continuation) params.continuation = continuation;

  const res = await api.get<{ data: ExplorerResult }>('/documents/explorer', { params });
  return res.data.data;
}

export interface DocumentViewResult {
  documentId: string;
  fileName: string;
  contentType: string;
  size: number;
  status: string;
  viewUrl: string;
  expiresIn: number;
}

export async function getDocumentView(documentId: string): Promise<DocumentViewResult> {
  const res = await api.get<{ data: DocumentViewResult }>(`/documents/${documentId}/view`);
  return res.data.data;
}

export async function getKeyView(key: string): Promise<DocumentViewResult> {
  const res = await api.get<{ data: DocumentViewResult }>('/documents/view/key', {
    params: { key },
  });
  return res.data.data;
}

export interface LinkedDocument {
  id: string;
  applicationId: string;
}

export async function linkDocument(
  documentId: string,
  applicationId: string,
  field?: string,
): Promise<LinkedDocument> {
  const res = await api.post<{ data: { document: LinkedDocument } }>(
    `/documents/${documentId}/link`,
    { applicationId, field },
  );
  return res.data.data.document;
}

// ---- Upload API (Chunk B: secure single-file) ----

export interface PresignDocumentInput {
  applicationId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
}

export interface PresignDocumentResult {
  documentId: string;
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

export async function presignDocument(
  input: PresignDocumentInput,
): Promise<PresignDocumentResult> {
  const res = await api.post<{
    data: PresignDocumentResult;
  }>('/documents/presign', input);
  return res.data.data;
}

export interface CompleteDocumentInput {
  documentId: string;
  applicationId: string;
  fileName: string;
  contentType: string;
}

export interface CompleteDocumentResult {
  id: string;
  applicationId: string;
  originalName: string;
  contentType: string;
  size: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function completeDocument(
  input: CompleteDocumentInput,
): Promise<CompleteDocumentResult> {
  const res = await api.post<{ data: { document: CompleteDocumentResult } }>(
    `/documents/${input.documentId}/complete`,
    {
      applicationId: input.applicationId,
      fileName: input.fileName,
      contentType: input.contentType,
    },
  );
  return res.data.data.document;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await api.delete(`/documents/${documentId}`);
}

// ---- Multipart API (Chunk C: large-file pipeline) ----

export interface MultipartPart {
  partNumber: number;
  etag: string;
}

export interface PresignMultipartResult {
  documentId: string;
  key: string;
  uploadId: string;
  partUrls: string[];
  partSize: number;
  totalParts: number;
  concurrency: number;
  expiresIn: number;
  abortAfterDays: number;
}

export async function presignMultipart(
  input: PresignDocumentInput,
): Promise<PresignMultipartResult> {
  const res = await api.post<{ data: PresignMultipartResult }>(
    '/documents/presign-multipart',
    input,
  );
  return res.data.data;
}

export interface CompleteMultipartInput {
  documentId: string;
  applicationId: string;
  fileName: string;
  contentType: string;
  uploadId: string;
  parts: MultipartPart[];
}

export async function completeMultipart(
  input: CompleteMultipartInput,
): Promise<CompleteDocumentResult> {
  const res = await api.post<{ data: { document: CompleteDocumentResult } }>(
    `/documents/${input.documentId}/complete-multipart`,
    {
      applicationId: input.applicationId,
      fileName: input.fileName,
      contentType: input.contentType,
      uploadId: input.uploadId,
      parts: input.parts,
    },
  );
  return res.data.data.document;
}

export interface AbortMultipartInput {
  documentId: string;
  applicationId: string;
  fileName: string;
  uploadId: string;
}

export async function abortMultipart(input: AbortMultipartInput): Promise<void> {
  await api.post(`/documents/multipart/${input.uploadId}/abort`, {
    applicationId: input.applicationId,
    documentId: input.documentId,
    fileName: input.fileName,
    uploadId: input.uploadId,
  });
}

export async function listUploadedParts(
  uploadId: string,
  applicationId: string,
  documentId: string,
  fileName: string,
): Promise<number[]> {
  const res = await api.get<{ data: { partNumbers: number[] } }>(
    `/documents/multipart/${uploadId}/parts`,
    { params: { applicationId, documentId, fileName } },
  );
  return res.data.data.partNumbers;
}

// ---- Document listing (flat list, no categories) ----

export interface DocumentSummary {
  id: string;
  applicationId: string;
  originalName: string;
  contentType: string;
  size: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const res = await api.get<{ data: { documents: DocumentSummary[] } }>(
    '/documents/documents',
  );
  return res.data.data.documents;
}

export async function bulkDeleteDocuments(documentIds: string[]): Promise<void> {
  await api.delete('/documents', { data: { documentIds } });
}

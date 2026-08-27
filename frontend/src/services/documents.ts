import api from './api';

export interface ExplorerEntry {
  name: string;
  type: 'folder' | 'file';
  key: string;
  size?: number;
  lastModified?: string;
  documentId?: string;
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

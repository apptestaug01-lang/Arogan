import api from './api';

export interface ExplorerEntry {
  name: string;
  type: 'folder' | 'file';
  key: string;
  size?: number;
  lastModified?: string;
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
  if (prefix) params.prefix = prefix
  if (continuation) params.continuation = continuation

  const res = await api.get<{ data: ExplorerResult }>('/documents/explorer', { params })
  return res.data.data
}

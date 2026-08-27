import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getStorageClient } from './storage.service.js'
import { getStorageConfig, StorageConfig } from '../config/storage.config.js'

const EXPLORER_DELIMITER = '/'

export interface ExplorerEntry {
  name: string
  type: 'folder' | 'file'
  key: string
  size?: number
  lastModified?: string
}

export interface ListExplorerInput {
  userId: string
  prefix?: string
  continuationToken?: string
}

export interface ListExplorerResult {
  prefix: string
  folders: ExplorerEntry[]
  files: ExplorerEntry[]
  nextToken: string | null
}

export class ExplorerError extends Error {
  statusCode: number
  isOperational: boolean
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ExplorerError'
    this.statusCode = statusCode
    this.isOperational = true
  }
}

function borrowerRoot(userId: string): string {
  return `borrowers/${userId}/`
}

export async function listExplorer(
  input: ListExplorerInput,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<ListExplorerResult> {
  const root = borrowerRoot(input.userId)
  let base = root

  if (input.prefix) {
    const normalized = input.prefix.replace(/^\/+/, '')
    if (!normalized.startsWith(root)) {
      throw new ExplorerError('Prefix must stay within your own borrower storage root')
    }
    base = normalized.endsWith('/') ? normalized : `${normalized}/`
  }

  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: base,
      Delimiter: EXPLORER_DELIMITER,
      ContinuationToken: input.continuationToken,
    }),
  )

  const folders: ExplorerEntry[] = (result.CommonPrefixes ?? []).map((cp) => {
    const key = cp.Prefix ?? ''
    const name = key.slice(base.length).replace(/\/$/, '')
    return { name, type: 'folder', key }
  })

  const files: ExplorerEntry[] = (result.Contents ?? [])
    .filter((o) => (o.Key ?? '') !== base)
    .map((o) => ({
      name: (o.Key ?? '').split('/').pop() ?? (o.Key ?? ''),
      type: 'file' as const,
      key: o.Key ?? '',
      size: o.Size ?? 0,
      lastModified: o.LastModified ? o.LastModified.toISOString() : undefined,
    }))

  return {
    prefix: base,
    folders,
    files,
    nextToken: result.NextContinuationToken ?? null,
  }
}

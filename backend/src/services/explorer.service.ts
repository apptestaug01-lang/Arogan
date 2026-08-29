import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getStorageClient, StorageError } from './storage.service.js'
import { getStorageConfig, StorageConfig } from '../config/storage.config.js'
import { prisma } from '../lib/prisma.js'

const EXPLORER_DELIMITER = '/'

export interface ExplorerEntry {
  name: string
  type: 'folder' | 'file'
  key: string
  size?: number
  lastModified?: string
  documentId?: string
  status?: string
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

  let result
  try {
    result = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: base,
        Delimiter: EXPLORER_DELIMITER,
        ContinuationToken: input.continuationToken,
      }),
    )
  } catch (err) {
    throw new StorageError(
      err instanceof Error ? err.message : 'Storage service unavailable',
    )
  }

  const folders: ExplorerEntry[] = (result.CommonPrefixes ?? []).map((cp) => {
    const key = cp.Prefix ?? ''
    const name = key.slice(base.length).replace(/\/$/, '')
    return { name, type: 'folder', key }
  })

  const rawFiles = (result.Contents ?? []).filter((o) => (o.Key ?? '') !== base)

  const documentIdByKey = new Map<string, { id: string; status: string }>()
  if (rawFiles.length > 0) {
    const keys = rawFiles.map((o) => o.Key ?? '').filter(Boolean)
    const linked = await prisma.document.findMany({
      where: { s3Key: { in: keys }, status: { not: 'DELETED' } },
      select: { id: true, s3Key: true, status: true },
    })
    for (const d of linked) documentIdByKey.set(d.s3Key, { id: d.id, status: d.status })
  }

  const files: ExplorerEntry[] = rawFiles.map((o) => {
    const doc = documentIdByKey.get(o.Key ?? '')
    return {
      name: (o.Key ?? '').split('/').pop() ?? (o.Key ?? ''),
      type: 'file' as const,
      key: o.Key ?? '',
      size: o.Size ?? 0,
      lastModified: o.LastModified ? o.LastModified.toISOString() : undefined,
      documentId: doc?.id,
      status: doc?.status,
    }
  })

  return {
    prefix: base,
    folders,
    files,
    nextToken: result.NextContinuationToken ?? null,
  }
}

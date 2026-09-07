import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { getStorageConfig } from '../config/storage.config.js'
import { createS3Client } from '../services/storage.service.js'
import { ArchiveService } from '../modules/documentArchive/archive.service.js'
import { BackfillRunner } from '../modules/documentArchive/backfill.js'
import logger from '../middleware/logger.js'

interface CliArgs {
  prefix?: string
  force: boolean
  dryRun: boolean
  concurrency: number
  limit?: number
  contentType?: string
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { force: false, dryRun: false, concurrency: 3 }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--prefix':
        args.prefix = argv[++i]
        break
      case '--force':
        args.force = true
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '--concurrency':
        args.concurrency = parseInt(argv[++i], 10)
        break
      case '--limit':
        args.limit = parseInt(argv[++i], 10)
        break
      case '--contentType':
        args.contentType = argv[++i]
        break
    }
  }
  return args
}

export const LOANFLOW_DERIVED_PREFIX = '.loanflow'
const JSON_SUFFIX = '.json'
const DELETED_PREFIX = 'DELETED_'

export function shouldSkipKey(key: string): boolean {
  const parts = key.split('/')
  const fileName = parts[parts.length - 1] || ''

  if (parts.includes(LOANFLOW_DERIVED_PREFIX)) return true
  if (key.includes(`/${LOANFLOW_DERIVED_PREFIX}/`)) return true
  if (fileName.endsWith(JSON_SUFFIX)) return true
  if (fileName.startsWith(DELETED_PREFIX)) return true
  if (fileName === '') return true

  return false
}

interface ListedObject {
  key: string
  size: number
}

export function listDocumentKeys(
  s3: S3Client,
  bucket: string,
  prefix: string | undefined,
  limit?: number,
): Promise<ListedObject[]> {
  return listObjects(s3, bucket, prefix, limit)
}

async function listObjects(
  s3: S3Client,
  bucket: string,
  prefix: string | undefined,
  limit?: number,
): Promise<ListedObject[]> {
  const results: ListedObject[] = []
  let continuationToken: string | undefined

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    )

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key) continue
        if (results.length >= (limit ?? Infinity)) break
        if (shouldSkipKey(obj.Key)) continue
        results.push({
          key: obj.Key,
          size: obj.Size ?? 0,
        })
      }
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken && (!limit || results.length < limit))

  return limit ? results.slice(0, limit) : results
}

interface BatchResult {
  completed: number
  skipped: number
  failed: number
  dryRun: boolean
}

export interface BatchArgs {
  prefix?: string
  force: boolean
  dryRun: boolean
  concurrency: number
  limit?: number
}

export async function runBatch(args: BatchArgs, archiveService: ArchiveService): Promise<BatchResult> {
  const runner = new BackfillRunner(archiveService, {
    concurrency: args.concurrency,
    rateLimitMs: 0,
  })

  logger.info({ prefix: args.prefix ?? 'borrowers/', dryRun: args.dryRun }, '[BatchConvert] Starting document-to-JSON conversion')

  const result = await runner.runOnce({ dryRun: args.dryRun })

  logger.info(
    {
      completed: result.completed,
      skipped: result.skipped,
      failed: result.failed,
      enqueued: result.enqueued,
      total: result.enqueued,
    },
    '[BatchConvert] Done',
  )

  if (result.failed > 0) {
    process.exit(1)
  }

  return { completed: result.completed, skipped: result.skipped, failed: result.failed, dryRun: result.dryRun }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  const archiveService = new ArchiveService()
  await runBatch(args, archiveService)
}

const isMain = process.argv[1] && process.argv[1].endsWith('batchConvertDocuments.ts')
if (isMain) {
  main().catch((err) => {
    logger.fatal({ err: err instanceof Error ? err.message : String(err) }, '[BatchConvert] Fatal error')
    process.exit(1)
  })
}

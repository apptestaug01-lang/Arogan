import { ListObjectsV2Command, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getStorageConfig } from '../config/storage.config.js'
import { createS3Client } from '../services/storage.service.js'
import { ArchiveService } from '../modules/documentArchive/archive.service.js'
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
  const config = getStorageConfig()
  const bucket = config.bucket
  const s3 = createS3Client(config)

  logger.info({ bucket, prefix: args.prefix ?? '(root)' }, '[BatchConvert] Starting document-to-JSON conversion')

  if (args.dryRun) {
    logger.info('[BatchConvert] DRY RUN — no archives will be created')
  }

  const documents = await listDocumentKeys(s3, bucket, args.prefix, args.limit)

  logger.info(
    {
      totalObjects: documents.length,
      candidates: documents.length,
      force: args.force,
      dryRun: args.dryRun,
      concurrency: args.concurrency,
    },
    '[BatchConvert]',
  )

  let completed = 0
  let skipped = 0
  let failed = 0

  const queue: ListedObject[] = [...documents]

  async function worker(workerId: number): Promise<void> {
    logger.info({ worker: workerId }, '[BatchConvert] Worker started')
    while (queue.length > 0) {
      const doc = queue.shift()!

      try {
        const head = await s3.send(
          new HeadObjectCommand({ Bucket: bucket, Key: doc.key }),
        )

        const contentType = head.ContentType ?? 'application/octet-stream'
        const metadata = head.Metadata ?? {}

        const documentId = metadata['document-id']
        const userId = metadata['user-id']

        if (!documentId || !userId) {
          skipped++
          logger.info({ key: doc.key }, '[BatchConvert] Skipping — no document-id/user-id metadata')
          continue
        }

        logger.info({ key: doc.key, size: doc.size, contentType, documentId }, '[BatchConvert] Processing')

        if (args.dryRun) {
          logger.info(
            { key: doc.key, documentId, format: contentType },
            '[BatchConvert] DRY RUN — would enqueue archive',
          )
          completed++
          continue
        }

        const result = await archiveService.createArchive({
          documentId,
          userId,
          force: args.force,
        })

        if (result.status === 'COMPLETED') {
          completed++
          logger.info({ key: doc.key, documentId, archiveKey: result.archiveKey }, '[BatchConvert] Archive created')
        } else {
          failed++
          logger.error(
            { key: doc.key, error: result.error?.message },
            '[BatchConvert] Conversion failed',
          )
        }
      } catch (err) {
        failed++
        logger.error({ key: doc.key, err: err instanceof Error ? err.message : String(err) }, '[BatchConvert] Failed')
      }
    }
  }

  await Promise.all(
    Array.from({ length: args.concurrency }, (_, i) => worker(i)),
  )

  logger.info(
    {
      completed,
      skipped,
      failed,
      total: completed + skipped + failed,
    },
    '[BatchConvert] Done',
  )

  if (failed > 0) {
    process.exit(1)
  }

  return { completed, skipped, failed, dryRun: args.dryRun }
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

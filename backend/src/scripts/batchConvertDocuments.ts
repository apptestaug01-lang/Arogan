import { ListObjectsV2Command, PutObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getStorageConfig } from '../config/storage.config.js'
import { createS3Client } from '../services/storage.service.js'
import { convertDocument, downloadFromS3 } from '../utils/documentConverter.js'
import logger from '../middleware/logger.js'

interface CliArgs {
  prefix?: string
  force: boolean
  dryRun: boolean
  concurrency: number
  limit?: number
  contentType?: string
}

function parseArgs(argv: string[]): CliArgs {
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

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
])

const JSON_SUFFIX = '.json'

function toJsonKey(originalKey: string): string {
  const lastSlash = originalKey.lastIndexOf('/')
  const dirPath = lastSlash >= 0 ? originalKey.slice(0, lastSlash + 1) : ''
  const baseName = lastSlash >= 0 ? originalKey.slice(lastSlash + 1) : originalKey
  const nameWithoutExt = baseName.replace(/\.[^.]+$/, '')
  return `${dirPath}${nameWithoutExt}${JSON_SUFFIX}`
}

async function objectExists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function getObjectContentType(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<string> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return head.ContentType ?? 'application/octet-stream'
  } catch {
    return 'application/octet-stream'
  }
}

interface ListedObject {
  key: string
  size: number
  etag: string
}

async function listDocuments(
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
        if (!obj.Key || obj.Key.endsWith(JSON_SUFFIX)) continue
        results.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          etag: obj.ETag?.replace(/"/g, '') ?? '',
        })
      }
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken && (!limit || results.length < limit))

  return limit ? results.slice(0, limit) : results
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  const config = getStorageConfig()
  const s3 = createS3Client(config)
  const bucket = config.bucket

  logger.info({ bucket, prefix: args.prefix ?? '(root)' }, '[BatchConvert] Starting document-to-JSON conversion')

  if (args.dryRun) {
    logger.info('[BatchConvert] DRY RUN — no files will be written')
  }

  const documents = await listDocuments(s3, bucket, args.prefix, args.limit)

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
  let errors = 0
  let contentTypeError = 0

  const queue: ListedObject[] = [...documents]

  async function worker(workerId: number): Promise<void> {
    logger.info({ worker: workerId }, '[BatchConvert] Worker started')
    while (queue.length > 0) {
      const doc = queue.shift()!
      const jsonKey = toJsonKey(doc.key)

      try {
        if (!args.force) {
          const exists = await objectExists(s3, bucket, jsonKey)
          if (exists) {
            skipped++
            logger.info({ key: doc.key, jsonKey }, '[BatchConvert] Skipping — JSON already exists')
            continue
          }
        }

        const contentType = await getObjectContentType(s3, bucket, doc.key)
        if (args.contentType ? contentType !== args.contentType : !ALLOWED_CONTENT_TYPES.has(contentType)) {
          skipped++
          contentTypeError++
          logger.info({ key: doc.key, contentType }, '[BatchConvert] Skipping — unsupported content type')
          continue
        }

        logger.info({ key: doc.key, size: doc.size, contentType }, '[BatchConvert] Downloading')

        const downloaded = await downloadFromS3(doc.key, s3, config, 100 * 1024 * 1024)

        logger.info({ key: doc.key }, '[BatchConvert] Converting to JSON')

        const converted = await convertDocument(
          downloaded.body,
          downloaded.contentType,
          doc.key.split('/').pop() ?? 'document',
          doc.key,
          {
            size: downloaded.size,
            checksum: downloaded.checksum,
          },
        )

        if (converted.error && !converted.rawText && converted.pages.length === 0) {
          errors++
          logger.error({ key: doc.key, error: converted.error }, '[BatchConvert] Conversion failed — no usable data')
          continue
        }

        const jsonStr = JSON.stringify(converted, null, 2)

        if (args.dryRun) {
          logger.info(
            { key: doc.key, jsonSize: jsonStr.length, format: converted.format },
            '[BatchConvert] DRY RUN — would upload JSON',
          )
          completed++
          continue
        }

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: jsonKey,
            Body: jsonStr,
            ContentType: 'application/json',
            Metadata: {
              'source-key': doc.key,
              'source-content-type': downloaded.contentType,
              'source-size': String(downloaded.size),
              'source-checksum': downloaded.checksum,
            },
          }),
        )

        completed++
        logger.info(
          {
            key: doc.key,
            jsonKey,
            jsonSize: jsonStr.length,
            format: converted.format,
            pages: converted.pages.length,
          },
          '[BatchConvert] Saved JSON to S3',
        )
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
      errors,
      contentTypeSkipped: contentTypeError,
      total: completed + skipped + failed,
    },
    '[BatchConvert] Done',
  )

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  logger.fatal({ err: err instanceof Error ? err.message : String(err) }, '[BatchConvert] Fatal error')
  process.exit(1)
})

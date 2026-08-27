import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutPublicAccessBlockCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getStorageConfig, StorageConfig } from '../config/storage.config.js'
import { PRESIGNED_UPLOAD_TTL_SECONDS } from '../utils/constants.js'
import logger from '../middleware/logger.js'

export function createS3Client(config: StorageConfig = getStorageConfig()): S3Client {
  const protocol = config.useSsl ? 'https' : 'http'
  const endpoint = `${protocol}://${config.endpoint}:${config.port}`
  return new S3Client({
    endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  })
}

let cachedClient: S3Client | null = null

export function getStorageClient(): S3Client {
  if (!cachedClient) {
    cachedClient = createS3Client()
  }
  return cachedClient
}

const CORS_RULES = [
  {
    AllowedHeaders: ['*'],
    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
    AllowedOrigins: [process.env.CORS_ORIGIN || 'http://localhost:5173'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 86400,
  },
]

export async function ensureBucket(
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.bucket }))
    return
  } catch {
    // Bucket missing (or not accessible) — attempt to create below.
  }

  await s3.send(new CreateBucketCommand({ Bucket: config.bucket }))

  // Best-effort hardening. MinIO may not implement BlockPublicAccess; treat
  // that as a warning rather than a failure so the bucket stays usable.
  try {
    await s3.send(
      new PutPublicAccessBlockCommand({
        Bucket: config.bucket,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      }),
    )
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'PutPublicAccessBlock not supported by storage backend; ensure the bucket policy is private',
    )
  }

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: config.bucket,
      CORSConfiguration: { CORSRules: CORS_RULES },
    }),
  )
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn: number = PRESIGNED_UPLOAD_TTL_SECONDS,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

export async function headObject(
  key: string,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<{ size: number; checksum: string }> {
  const result = await s3.send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
  )
  const checksum = result.ETag ? result.ETag.replace(/"/g, '') : ''
  return { size: result.ContentLength ?? 0, checksum }
}

export async function checkStorageHealth(
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.bucket }))
    return true
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'Storage health check failed',
    )
    return false
  }
}

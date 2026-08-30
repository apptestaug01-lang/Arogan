import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  DeleteObjectCommand,
  PutPublicAccessBlockCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getStorageConfig, StorageConfig } from '../config/storage.config.js'
import { PRESIGNED_UPLOAD_TTL_SECONDS, PRESIGNED_DOWNLOAD_TTL_SECONDS, MULTIPART_ABORT_DAYS } from '../utils/constants.js'
import logger from '../middleware/logger.js'

export function createS3Client(config: StorageConfig = getStorageConfig()): S3Client {
  const protocol = config.useSsl ? 'https' : 'http'
  const endpoint = `${protocol}://${config.endpoint}:${config.port}`
  return new S3Client({
    endpoint,
    region: config.region,
    forcePathStyle: true,
    // MinIO rejects the checksum query params the AWS SDK v3 adds to presigned
    // URLs (x-amz-checksum-*, x-amz-sdk-checksum-algorithm), causing
    // SignatureDoesNotMatch. Only calculate checksums when explicitly needed.
    requestChecksumCalculation: 'WHEN_REQUIRED',
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
    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
    AllowedOrigins: [process.env.CORS_ORIGIN || 'http://localhost:5173'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 86400,
  },
]

export async function ensureBucket(
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<void> {
  const bucketExists = await s3.send(new HeadBucketCommand({ Bucket: config.bucket }))
    .then(() => true)
    .catch(() => false)

  if (!bucketExists) {
    await s3.send(new CreateBucketCommand({ Bucket: config.bucket }))
  }

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

  // Best-effort cleanup: abort multipart uploads abandoned mid-flight so
  // partial parts don't accrue. MinIO may not support lifecycle config;
  // treat that as a warning rather than a failure.
  try {
    await s3.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: config.bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'abort-incomplete-multipart-uploads',
              Status: 'Enabled',
              Filter: {},
              AbortIncompleteMultipartUpload: { DaysAfterInitiation: MULTIPART_ABORT_DAYS },
            },
          ],
        },
      }),
    )
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Bucket lifecycle configuration not supported; incomplete multipart uploads need manual cleanup',
    )
  }
}

export async function createPresignedUploadPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn: number = PRESIGNED_UPLOAD_TTL_SECONDS,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: config.bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  })
  return getSignedUrl(s3, command, { expiresIn })
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

export async function createPresignedDownloadUrl(
  key: string,
  expiresIn: number = PRESIGNED_DOWNLOAD_TTL_SECONDS,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
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

export async function deleteObject(
  key: string,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  )
}

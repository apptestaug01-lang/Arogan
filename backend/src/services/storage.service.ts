import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
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
    // Backblaze B2 rejects the checksum query params the AWS SDK v3 adds to presigned
    // URLs (x-amz-checksum-*, x-amz-sdk-checksum-algorithm), causing
    // SignatureDoesNotMatch. Only calculate checksums when explicitly needed.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  })
}

export function getStorageClient(): S3Client {
  // Always create fresh client to pick up env var changes
  return createS3Client()
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
  logger.info('[Storage] Ensuring bucket exists: ' + config.bucket + ' at endpoint: ' + config.endpoint)

  const bucketExists = await s3.send(new HeadBucketCommand({ Bucket: config.bucket }))
    .then(() => true)
    .catch((err) => {
      logger.warn('[Storage] HeadBucket failed:', err.message || err)
      return false
    })

  if (!bucketExists) {
    logger.info('[Storage] Bucket not found, creating: ' + config.bucket)
    try {
      await s3.send(new CreateBucketCommand({ Bucket: config.bucket }))
      logger.info('[Storage] Bucket created successfully')
    } catch (createErr) {
      logger.error({ err: createErr instanceof Error ? createErr.message : String(createErr) }, '[Storage] Failed to create bucket')
      throw createErr
    }

    // Best-effort hardening. Some S3-compatible backends may not implement BlockPublicAccess; treat
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

    // Best-effort cleanup: abort multipart uploads abandoned mid-flight so
    // partial parts don't accrue. Some S3-compatible backends may not support lifecycle config;
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

  // Always update CORS rules to ensure local development works
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: config.bucket,
        CORSConfiguration: { CORSRules: CORS_RULES },
      }),
    )
    logger.info('[Storage] CORS rules updated')
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Failed to update CORS rules',
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
  logger.info('[Storage] Creating presigned upload URL for key: ' + key)
  logger.info('[Storage] Using bucket: ' + config.bucket + ', endpoint: ' + config.endpoint + ', region: ' + config.region)
  
  try {
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    })
    const url = await getSignedUrl(s3, command, { expiresIn })
    logger.info('[Storage] Presigned URL created successfully')
    return url
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, '[Storage] Failed to create presigned URL')
    throw err
  }
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
): Promise<{ size: number; checksum: string; contentType: string; etag: string }> {
  const result = await s3.send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
  )
  const etag = result.ETag ? result.ETag.replace(/"/g, '') : ''
  return {
    size: result.ContentLength ?? 0,
    checksum: etag,
    contentType: result.ContentType ?? 'application/octet-stream',
    etag,
  }
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

export async function getObject(
  key: string,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<{ body: Uint8Array; contentType: string }> {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  )
  if (!result.Body) throw new Error(`Empty body for key: ${key}`)
  const chunks: Buffer[] = []
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return { body: Buffer.concat(chunks), contentType: result.ContentType ?? 'application/octet-stream' }
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: contentType }),
  )
}

export interface ListedObject {
  key: string;
  size: number;
  etag?: string;
}

export async function listObjects(
  prefix: string,
  s3: S3Client = getStorageClient(),
  config: StorageConfig = getStorageConfig(),
): Promise<ListedObject[]> {
  const results: ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    if (result.Contents) {
      for (const item of result.Contents) {
        if (item.Key) {
          results.push({
            key: item.Key,
            size: item.Size ?? 0,
            etag: item.ETag ? item.ETag.replace(/"/g, '') : undefined,
          });
        }
      }
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return results;
}

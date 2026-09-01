export interface StorageConfig {
  endpoint: string
  port: number
  useSsl: boolean
  accessKey: string
  secretKey: string
  bucket: string
  region: string
  provider: 'minio' | 'r2' | 's3'
}

export function getStorageConfig(): StorageConfig {
  // Use Cloudflare R2 if R2_ACCOUNT_ID is set
  if (process.env.R2_ACCOUNT_ID) {
    return {
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      port: 443,
      useSsl: true,
      accessKey: process.env.R2_ACCESS_KEY_ID || '',
      secretKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.R2_BUCKET || 'loanflow-documents',
      region: 'auto',
      provider: 'r2',
    }
  }

  // Fallback to MinIO
  return {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSsl: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'loanflow-documents',
    region: process.env.MINIO_REGION || 'us-east-1',
    provider: 'minio',
  }
}

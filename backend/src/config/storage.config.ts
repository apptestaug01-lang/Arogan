export interface StorageConfig {
  endpoint: string
  port: number
  useSsl: boolean
  accessKey: string
  secretKey: string
  bucket: string
  region: string
  provider: 'minio' | 'r2' | 'b2' | 's3'
}

export function getStorageConfig(): StorageConfig {
  // Use Backblaze B2 if B2 credentials are set
  if (process.env.B2_KEY_ID && process.env.B2_APPLICATION_KEY) {
    return {
      endpoint: `s3.${process.env.B2_REGION || 'us-east-005'}.backblazeb2.com`,
      port: 443,
      useSsl: true,
      accessKey: process.env.B2_KEY_ID,
      secretKey: process.env.B2_APPLICATION_KEY,
      bucket: process.env.B2_BUCKET || 'loanflow-documents',
      region: process.env.B2_REGION || 'us-east-005',
      provider: 'b2',
    }
  }

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

  // Default to Backblaze B2 (no MinIO fallback)
  return {
    endpoint: `s3.${process.env.B2_REGION || 'us-east-005'}.backblazeb2.com`,
    port: 443,
    useSsl: true,
    accessKey: process.env.B2_KEY_ID || '',
    secretKey: process.env.B2_APPLICATION_KEY || '',
    bucket: process.env.B2_BUCKET || 'loanflow-documents',
    region: process.env.B2_REGION || 'us-east-005',
    provider: 'b2',
  }
}

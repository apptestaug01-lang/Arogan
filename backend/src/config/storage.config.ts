export interface StorageConfig {
  endpoint: string
  port: number
  useSsl: boolean
  accessKey: string
  secretKey: string
  bucket: string
  region: string
}

export function getStorageConfig(): StorageConfig {
  return {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSsl: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'loanflow-documents',
    region: process.env.MINIO_REGION || 'us-east-1',
  }
}

// Mirrors backend constants from `backend/src/utils/constants.ts`.
// Keep these in sync — the FileDropzone validation must match the
// server-side allow-list so a rejected file is caught client-side first.

export const ALLOWED_DOCUMENT_CONTENT_TYPES: string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB (S3 single-PUT ceiling)

// Multipart upload — >100 MB chunking strategy
export const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB
export const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024; // 64 MB per part
export const MULTIPART_CONCURRENCY = 4; // parallel part uploads
export const MULTIPART_MAX_PARTS = 10000; // S3 hard ceiling
export const MULTIPART_ABORT_DAYS = 7; // lifecycle cleanup for orphaned uploads

// Presigned URL TTLs
export const PRESIGNED_UPLOAD_TTL_SECONDS = 15 * 60; // 15 minutes
export const PRESIGNED_DOWNLOAD_TTL_SECONDS = 5 * 60; // 5 minutes

// File extension → content type lookup for client-side validation + accept attr
export const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const ACCEPTED_FILE_EXTENSIONS = Object.keys(CONTENT_TYPE_BY_EXTENSION);

export function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getContentTypeForFile(name: string): string | undefined {
  const ext = getFileExtension(name);
  return ext ? CONTENT_TYPE_BY_EXTENSION[ext] : undefined;
}

export function isAllowedFileType(file: File): boolean {
  const ext = getFileExtension(file.name);
  const ct = CONTENT_TYPE_BY_EXTENSION[ext];
  if (!ct) return false;
  return ALLOWED_DOCUMENT_CONTENT_TYPES.includes(ct);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes ?? 0} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export function formatFileSizeDisplay(file: File): string {
  return formatBytes(file.size);
}

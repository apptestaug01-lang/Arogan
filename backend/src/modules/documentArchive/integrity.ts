import { Buffer } from 'node:buffer';
import { ARCHIVE_EMBED_MAX_BYTES, ARCHIVE_GZ_OBJECT_MAX_BYTES } from '../../utils/constants.js';

export async function sha256(buf: Buffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Buffer.from(hash).toString('hex');
}

export async function gzipBuf(buf: Buffer): Promise<Buffer> {
  const { gzipSync } = await import('node:zlib');
  return gzipSync(buf);
}

export async function gunzipBuf(buf: Buffer): Promise<Buffer> {
  const { gunzipSync } = await import('node:zlib');
  return gunzipSync(buf);
}

export function b64Encode(buf: Buffer): string {
  return buf.toString('base64');
}

export function b64Decode(str: string): Buffer {
  return Buffer.from(str, 'base64');
}

export function chooseByteTier(size: number): 'embedded' | 'gz-object' | 'source-object' {
  if (size <= ARCHIVE_EMBED_MAX_BYTES) return 'embedded';
  if (size <= ARCHIVE_GZ_OBJECT_MAX_BYTES) return 'gz-object';
  return 'source-object';
}

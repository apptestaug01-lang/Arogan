export type ArchiveSchemaVersion = '1.0';

export const ARCHIVE_SCHEMA_VERSION: ArchiveSchemaVersion = '1.0';

export type ArchiveFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'image' | 'unknown';

export type OriginalAvailability = 'embedded' | 'gz-object' | 'source-object';

export type ByteTier = 'embedded' | 'gz-object' | 'source-object';

export interface ArchiveSource {
  key: string;
  contentType: string;
  size: number;
  sha256: string;
  originalName: string;
  uploadedAt: string;
  etag?: string;
}

export interface ArchiveFidelity {
  roundTripVerified: boolean;
  originalAvailable: OriginalAvailability;
  warnings: string[];
}

export interface ArchiveTextRun {
  text: string;
  font?: string;
  size?: number;
  color?: string;
}

export interface ArchiveTextBlock {
  kind: 'text';
  bbox: [number, number, number, number];
  runs: ArchiveTextRun[];
}

export interface ArchiveTableBlock {
  kind: 'table';
  bbox: [number, number, number, number];
  rows: Array<Array<{ t: string; v: string | number }>>;
}

export interface ArchiveImageBlock {
  kind: 'image';
  bbox: [number, number, number, number];
  asset: string;
}

export type PageBlock = ArchiveTextBlock | ArchiveTableBlock | ArchiveImageBlock;

export interface OcrWord {
  text: string;
  bbox: [number, number, number, number];
  conf: number;
}

export interface PageOcr {
  words: OcrWord[];
  text: string;
}

export interface ArchivePage {
  pageNumber: number;
  width?: number;
  height?: number;
  blocks: PageBlock[];
  ocr: PageOcr | null;
}

export interface ArchiveText {
  rawText: string;
  charCount: number;
  searchable: boolean;
}

export interface ArchiveAsset {
  name: string;
  key: string;
  sha256: string;
  size: number;
}

export interface ByteArchiveEmbedded {
  encoding: 'base64';
  compression: 'gzip';
  rawSize: number;
  archiveSize: number;
  data: string;
}

export interface ByteArchiveReference {
  encoding: 'base64';
  compression: 'gzip';
  rawSize: number;
  sha256: string;
  key: string;
}

export type ByteArchive = ByteArchiveEmbedded | ByteArchiveReference | null;

export interface ArchiveField {
  value: string | number | boolean | string[];
  confidence: number;
  source: string;
  page?: number;
}

export interface DocumentArchive {
  schemaVersion: ArchiveSchemaVersion;
  archiveType: 'document-archive';
  id: string;
  generatedBy: {
    tool: string;
    version: string;
    at: string;
  };
  source: ArchiveSource;
  fidelity: ArchiveFidelity;
  format: ArchiveFormat;
  metadata: Record<string, unknown>;
  pages: ArchivePage[];
  text: ArchiveText;
  assets: ArchiveAsset[];
  byteArchive: ByteArchive;
  classification: {
    documentType: string;
    confidence: number;
  };
  fields: Record<string, ArchiveField>;
}

export type ParsedArchive = DocumentArchive;

export class ArchiveVersionError extends Error {
  constructor(public readonly version: string) {
    super(`Unsupported schemaVersion: ${version}. Only "1.0" is supported.`);
    this.name = 'ArchiveVersionError';
  }
}

export function parseArchive(buf: Buffer): ParsedArchive {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buf.toString('utf-8'));
  } catch (err) {
    throw new Error(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = validateArchive(parsed as Partial<DocumentArchive>, true);
  return result as ParsedArchive;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateArchive(
  archive: Partial<DocumentArchive>,
  throwOnInvalid: boolean = false,
): ParsedArchive | ValidationResult {
  const errors: string[] = [];

  if (!archive || typeof archive !== 'object' || Array.isArray(archive)) {
    if (throwOnInvalid) throw new Error('Archive must be a JSON object');
    return { valid: false, errors: ['Archive must be a JSON object'] };
  }

  if (archive.schemaVersion !== ARCHIVE_SCHEMA_VERSION) {
    if (throwOnInvalid) throw new ArchiveVersionError(String(archive.schemaVersion));
    errors.push(`schemaVersion must be "1.0", got "${archive.schemaVersion}"`);
  }

  if (!archive.source || typeof archive.source !== 'object') {
    errors.push('source is required');
  } else {
    const s = archive.source as Partial<ArchiveSource>;
    if (!s.sha256) errors.push('source.sha256 is required');
    if (!s.key) errors.push('source.key is required');
    if (typeof s.size !== 'number') errors.push('source.size must be a number');
  }

  if (!archive.fidelity || typeof archive.fidelity !== 'object') {
    errors.push('fidelity is required');
  } else {
    const f = archive.fidelity as Partial<ArchiveFidelity>;
    if (typeof f.roundTripVerified !== 'boolean') {
      errors.push('fidelity.roundTripVerified must be boolean');
    }
    if (!f.originalAvailable) {
      errors.push('fidelity.originalAvailable is required');
    }
  }

  if (throwOnInvalid && errors.length > 0) {
    throw new Error(`Archive validation failed: ${errors.join('; ')}`);
  }

  if (throwOnInvalid) {
    return archive as ParsedArchive;
  }

  return { valid: errors.length === 0, errors };
}

export { validateArchive as validateArchiveResult };

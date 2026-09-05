import { Buffer } from 'node:buffer';
import { prisma } from '../../lib/prisma.js';
import logger from '../../middleware/logger.js';
import { logAuditEvent } from '../../services/audit.service.js';
import {
  headObject,
  getObject,
  putObject,
  createPresignedDownloadUrl,
} from '../../services/storage.service.js';
import { buildArchiveKey } from '../../utils/documentKey.js';
import {
  LOANFLOW_DERIVED_PREFIX,
  ARCHIVE_EMBED_MAX_BYTES,
  ARCHIVE_CONVERT_TIMEOUT_MS,
  ARCHIVE_SCHEMA_VERSION,
} from '../../utils/constants.js';
import { sha256, gzipBuf, chooseByteTier } from './integrity.js';
import {
  ArchiveConverterRegistry,
  DEFAULT_CONVERTERS,
  ConvertContext,
} from './converters/index.js';

export interface CreateArchiveInput {
  documentId: string;
  userId: string;
  force?: boolean;
}

export interface ArchiveStatus {
  status: string;
  archiveKey?: string | null;
  sourceSha256?: string | null;
  byteTier?: string | null;
  converterVersion?: string | null;
  fidelityVerified: boolean;
  warnings: string[];
  error?: { code?: string; message?: string } | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  updatedAt?: Date | null;
}

export interface CreateArchiveResult {
  status: string;
  archiveKey?: string | null;
  error?: { code?: string; message?: string } | null;
}

export interface ArchiveViewResult {
  archiveKey: string;
  url: string;
}

const CONVERTER_VERSION = '1.0.0';

export class ArchiveService {
  private registry: ArchiveConverterRegistry;

  constructor(registry: ArchiveConverterRegistry = new ArchiveConverterRegistry(DEFAULT_CONVERTERS)) {
    this.registry = registry;
  }

  async getArchiveStatus(documentId: string): Promise<ArchiveStatus | null> {
    const row = await prisma.documentArchive.findUnique({
      where: { documentId },
    });
    if (!row) return null;

    return {
      status: row.status,
      archiveKey: row.archiveKey,
      sourceSha256: row.sourceSha256,
      byteTier: row.byteTier,
      converterVersion: row.converterVersion,
      fidelityVerified: row.fidelityVerified,
      warnings: (row.warnings as string[]) || [],
      error: (row.error as { code?: string; message?: string } | null) || null,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      updatedAt: row.updatedAt,
    };
  }

  async createArchive(input: CreateArchiveInput): Promise<CreateArchiveResult> {
    const { documentId, userId, force = false } = input;

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      return { status: 'FAILED', error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' } };
    }
    if (doc.userId !== userId) {
      return { status: 'FAILED', error: { code: 'UNAUTHORIZED', message: 'Not authorized' } };
    }
    if (doc.status === 'DELETED') {
      return { status: 'FAILED', error: { code: 'DOCUMENT_DELETED', message: 'Document is deleted' } };
    }

    const existing = await prisma.documentArchive.findUnique({
      where: { documentId },
    });

    try {
      const meta = await headObject(doc.s3Key);

      if (
        !force &&
        existing?.status === 'COMPLETED' &&
        existing.converterVersion === CONVERTER_VERSION &&
        existing.sourceSha256 !== null
      ) {
        logger.info(
          { documentId, sourceSha256: existing.sourceSha256 },
          '[Archive] Skipping — already COMPLETED with matching converter version',
        );
        return { status: 'COMPLETED', archiveKey: existing.archiveKey };
      }

      await prisma.documentArchive.update({
        where: { documentId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const getResult = await getObject(doc.s3Key);
      const body = Buffer.isBuffer(getResult.body) ? getResult.body : Buffer.from(getResult.body as Uint8Array);
      const sourceSha256 = await sha256(body);
      const sourceSize = body.length;
      const detectedContentType = getResult.contentType || doc.contentType;

      if (force && existing) {
        await prisma.documentArchive.update({
          where: { documentId },
          data: {
            status: 'PROCESSING',
            startedAt: new Date(),
          },
        });
      } else if (!existing) {
        await prisma.documentArchive.create({
          data: {
            documentId,
            status: 'PROCESSING',
            converterVersion: CONVERTER_VERSION,
            startedAt: new Date(),
          },
        });
      }

      const ctx: ConvertContext = {
        documentId,
        sourceKey: doc.s3Key,
        fileName: doc.originalName,
        contentType: detectedContentType,
        detectedContentType,
        body,
        sourceSize,
        sourceSha256,
        logger: {
          warn: (msg: string) => logger.warn({ documentId }, msg),
          info: (msg: string) => logger.info({ documentId }, msg),
        },
      };

      const converter = this.registry.getConverter(detectedContentType);
      if (!converter) {
        throw new Error(`No converter for content type: ${detectedContentType}`);
      }

      const build = await withTimeout(converter.convert(ctx), ARCHIVE_CONVERT_TIMEOUT_MS);

      const byteTier = chooseByteTier(sourceSize);
      const warnings = build.warnings;

      let byteArchive: unknown = null;
      if (sourceSize <= ARCHIVE_EMBED_MAX_BYTES) {
        const gz = await gzipBuf(body);
        byteArchive = {
          encoding: 'base64',
          compression: 'gzip',
          rawSize: sourceSize,
          archiveSize: gz.length,
          data: gz.toString('base64'),
        };
      }

      const archive = {
        schemaVersion: ARCHIVE_SCHEMA_VERSION,
        archiveType: 'document-archive',
        id: documentId,
        generatedBy: {
          tool: 'loanflow-archiver',
          version: CONVERTER_VERSION,
          at: new Date().toISOString(),
        },
        source: {
          key: doc.s3Key,
          contentType: detectedContentType,
          size: sourceSize,
          sha256: sourceSha256,
          originalName: doc.originalName,
          uploadedAt: doc.createdAt.toISOString(),
          etag: existing?.sourceEtag ?? meta.checksum,
        },
        fidelity: {
          roundTripVerified: true,
          originalAvailable: byteTier === 'embedded' ? 'embedded' : byteTier === 'gz-object' ? 'gz-object' : 'source-object',
          warnings,
        },
        format: build.format,
        metadata: build.metadata,
        pages: build.pages,
        text: build.text,
        assets: build.assets,
        byteArchive,
        classification: build.classification || { documentType: 'UNKNOWN', confidence: 0 },
        fields: build.fields || {},
      };

      const archiveKey = buildArchiveKey(documentId);
      const manifestKey = buildArchiveKey(documentId, 'manifest');

      await putObject(archiveKey, Buffer.from(JSON.stringify(archive)), 'application/json');

      const manifest = {
        archiveKey,
        converterVersion: CONVERTER_VERSION,
        schemaVersion: ARCHIVE_SCHEMA_VERSION,
        sourceSha256,
        sourceSize,
        byteTier,
        warnings,
        convertedAt: new Date().toISOString(),
      };
      await putObject(manifestKey, Buffer.from(JSON.stringify(manifest)), 'application/json');

      await prisma.documentArchive.update({
        where: { documentId },
        data: {
          status: 'COMPLETED',
          schemaVersion: ARCHIVE_SCHEMA_VERSION,
          converterVersion: CONVERTER_VERSION,
          archiveKey,
          sourceSha256,
          sourceEtag: meta.checksum,
          sourceSize,
          byteTier,
          fidelityVerified: true,
          warnings: JSON.stringify(warnings),
          assets: JSON.stringify(build.assets),
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await logAuditEvent('ARCHIVE_COMPLETED', undefined, undefined, userId, {
        documentId,
        archiveKey,
        byteTier,
        sourceSha256,
      });

      logger.info({ documentId, archiveKey, byteTier }, '[Archive] Completed');

      return { status: 'COMPLETED', archiveKey };
    } catch (err) {
      const isMissing = err instanceof Error && /NotFound|not found/i.test(err.message);
      await prisma.documentArchive.update({
        where: { documentId },
        data: {
          status: 'FAILED',
          error: JSON.stringify({
            code: isMissing ? 'SOURCE_MISSING' : 'ARCHIVE_ERROR',
            message: err instanceof Error ? err.message : String(err),
          }),
          warnings: JSON.stringify([]),
          updatedAt: new Date(),
        },
      });

      await logAuditEvent('ARCHIVE_FAILED', undefined, undefined, userId, {
      documentId,
      error: err instanceof Error ? err.message : String(err),
      });

      return {
        status: 'FAILED',
        error: {
          code: isMissing ? 'SOURCE_MISSING' : 'ARCHIVE_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  async getArchiveView(documentId: string, userId: string): Promise<ArchiveViewResult | null> {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== userId) return null;

    const row = await prisma.documentArchive.findUnique({
      where: { documentId },
    });
    if (!row || row.status !== 'COMPLETED' || !row.archiveKey) return null;

    const prefix = LOANFLOW_DERIVED_PREFIX;
    const keyParts = row.archiveKey.split('/');
    if (keyParts[0] !== prefix || keyParts[1] !== documentId) {
      return null;
    }

    const url = await createPresignedDownloadUrl(row.archiveKey);
    return { archiveKey: row.archiveKey, url };
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Conversion timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export const archiveService = new ArchiveService();

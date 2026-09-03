import { PrismaClient } from '@prisma/client';
import { ExtractionPipeline, PipelineResult } from './extractionPipeline.js';
import {
  AutoFillResult,
  ExtractedField,
  WizardStep,
} from './types.js';
import {
  FIELD_SOURCES,
  getFieldsForStep,
  getStepForField,
  isKnownField,
} from './fieldSources.js';

const prisma = new PrismaClient();

export interface ExtractAllResult {
  documents: Array<{
    documentId: string;
    fileName: string;
    documentType: string;
    status: 'processing' | 'completed' | 'error';
    modelUsed?: string;
    error?: string;
  }>;
  extractedFields: Record<string, ExtractedField>;
  fieldsByStep: Record<WizardStep, Record<string, ExtractedField>>;
  totalDocuments: number;
  processedDocuments: number;
  cacheStatus: 'cached' | 'live' | 'mixed';
}

export class AutoFillService {
  constructor(private pipeline: ExtractionPipeline = new ExtractionPipeline(prisma)) {}

  async autoFillStep(
    userId: string,
    applicationId: string,
    step: WizardStep,
    documentIds?: string[],
    opts: { force?: boolean } = {},
  ): Promise<{ data: AutoFillResult; cacheStatus: 'cached' | 'live' | 'mixed' }> {
    const docs = await this.getDocuments(userId, applicationId, documentIds);
    if (docs.length === 0) {
      return {
        data: { step, extractedFields: {}, unmatchedDocuments: [], missingFields: getFieldsForStep(step) },
        cacheStatus: 'cached',
      };
    }

    const results = await this.pipeline.processMany(
      docs.map((d) => ({ id: d.id, s3Key: d.s3Key, originalName: d.originalName })),
      opts,
    );

    return {
      data: this.mergeForStep(results, step),
      cacheStatus: this.summarizeCacheStatus(results),
    };
  }

  async extractFromDocument(
    userId: string,
    documentId: string,
  ): Promise<Record<string, ExtractedField> | null> {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId, status: { not: 'DELETED' } },
      select: { id: true, s3Key: true, originalName: true },
    });
    if (!doc) return null;
    const result = await this.pipeline.processDocument({
      id: doc.id,
      s3Key: doc.s3Key,
      originalName: doc.originalName,
    });
    return result.fields;
  }

  async extractAllDocuments(
    userId: string,
    applicationId: string,
    opts: { force?: boolean } = {},
  ): Promise<ExtractAllResult> {
    const docs = await this.getDocuments(userId, applicationId);
    if (docs.length === 0) {
      return {
        documents: [],
        extractedFields: {},
        fieldsByStep: { kyc: {}, business: {}, financials: {}, loan: {} },
        totalDocuments: 0,
        processedDocuments: 0,
        cacheStatus: 'cached',
      };
    }

    const results = await this.pipeline.processMany(
      docs.map((d) => ({ id: d.id, s3Key: d.s3Key, originalName: d.originalName })),
      opts,
    );

    const allExtracted: Record<string, ExtractedField> = {};
    const fieldsByStep: Record<WizardStep, Record<string, ExtractedField>> = {
      kyc: {},
      business: {},
      financials: {},
      loan: {},
    };

    for (const r of results) {
      for (const [field, value] of Object.entries(r.fields)) {
        if (!allExtracted[field] || value.confidence > allExtracted[field].confidence) {
          allExtracted[field] = value;
        }
        const step = getStepForField(field);
        if (step) {
          if (!fieldsByStep[step][field] || value.confidence > fieldsByStep[step][field].confidence) {
            fieldsByStep[step][field] = value;
          }
        }
      }
    }

    return {
      documents: results.map((r) => ({
        documentId: r.documentId,
        fileName: r.fileName,
        documentType: r.documentType,
        status: 'completed' as const,
        modelUsed: r.modelUsed,
      })),
      extractedFields: allExtracted,
      fieldsByStep,
      totalDocuments: docs.length,
      processedDocuments: results.length,
      cacheStatus: this.summarizeCacheStatus(results),
    };
  }

  private mergeForStep(results: PipelineResult[], step: WizardStep): AutoFillResult {
    const targetFields = getFieldsForStep(step);
    const extracted: Record<string, ExtractedField> = {};
    const contributedFiles = new Set<string>();

    for (const field of targetFields) {
      const sources = FIELD_SOURCES[field] ?? [];
      for (const sourceType of sources) {
        const sourceResult = results.find((r) => r.documentType === sourceType);
        if (sourceResult && sourceResult.fields[field]) {
          extracted[field] = sourceResult.fields[field];
          contributedFiles.add(sourceResult.fileName);
          break;
        }
      }
    }

    const unmatched = results
      .filter((r) => !contributedFiles.has(r.fileName) && r.fields && Object.keys(r.fields).length > 0)
      .map((r) => r.fileName);

    const missingFields = targetFields.filter((f) => !extracted[f]);

    return { step, extractedFields: extracted, unmatchedDocuments: unmatched, missingFields };
  }

  private summarizeCacheStatus(results: PipelineResult[]): 'cached' | 'live' | 'mixed' {
    if (results.length === 0) return 'cached';
    const hasCached = results.some((r) => r.cacheStatus === 'cached');
    const hasLive = results.some((r) => r.cacheStatus === 'live');
    if (hasCached && hasLive) return 'mixed';
    if (hasLive) return 'live';
    return 'cached';
  }

  private async getDocuments(userId: string, applicationId: string, documentIds?: string[]) {
    return prisma.document.findMany({
      where: {
        userId,
        applicationId,
        id: documentIds ? { in: documentIds } : undefined,
        status: { not: 'DELETED' },
      },
      select: { id: true, s3Key: true, originalName: true, contentType: true },
    });
  }
}

export { isKnownField };

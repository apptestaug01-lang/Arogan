import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { ParserRegistry } from './parsers/index.js';
import { ExtractorRegistry } from './extractors/index.js';
import { LlmExtractor } from './llmExtractor.js';
import { classifyDocument } from './classifier.js';
import {
  DocumentType,
  ExtractedField,
  ParsedDocument,
} from './types.js';
import { getStorageConfig } from '../../config/storage.config.js';
import logger from '../../middleware/logger.js';

export interface PipelineDocumentInput {
  id: string;
  s3Key: string;
  originalName: string;
}

export interface PipelineResult {
  documentId: string;
  fileName: string;
  documentType: DocumentType;
  fields: Record<string, ExtractedField>;
  modelUsed: 'cloudflare-llama3' | 'regex' | 'hybrid';
  cacheStatus: 'cached' | 'live';
}

const MAX_CONCURRENCY = 4;

export class ExtractionPipeline {
  private s3: S3Client;
  private bucket: string;

  constructor(
    private prisma: PrismaClient,
    private parsers: ParserRegistry = new ParserRegistry(),
    private llm: LlmExtractor = new LlmExtractor(),
    private regex: ExtractorRegistry = new ExtractorRegistry(),
    storageConfig = getStorageConfig(),
  ) {
    const protocol = storageConfig.useSsl ? 'https' : 'http';
    this.s3 = new S3Client({
      endpoint: `${protocol}://${storageConfig.endpoint}:${storageConfig.port}`,
      region: storageConfig.region,
      credentials: {
        accessKeyId: storageConfig.accessKey,
        secretAccessKey: storageConfig.secretKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    this.bucket = storageConfig.bucket;
  }

  async processDocument(
    doc: PipelineDocumentInput,
    opts: { force?: boolean } = {},
  ): Promise<PipelineResult> {
    if (!opts.force) {
      const existing = await this.prisma.documentExtraction.findUnique({
        where: { documentId: doc.id },
      });
      if (existing && existing.status === 'completed') {
        return {
          documentId: doc.id,
          fileName: doc.originalName,
          documentType: existing.documentType as DocumentType,
          fields: (existing.fields as unknown as Record<string, ExtractedField>) ?? {},
          modelUsed: (existing.modelUsed as PipelineResult['modelUsed']) ?? 'regex',
          cacheStatus: 'cached',
        };
      }
    }

    let record = await this.prisma.documentExtraction.upsert({
      where: { documentId: doc.id },
      update: { status: 'processing', error: null },
      create: {
        documentId: doc.id,
        documentType: 'UNKNOWN',
        rawText: '',
        pages: [],
        fields: {},
        status: 'processing',
      },
    });

    try {
      const parsed = await this.fetchAndParse(doc);
      const classification = classifyDocument(doc.originalName, parsed.rawText);
      const extraction = await this.extract(doc.originalName, classification.type, parsed.rawText);
      const merged = this.mergeLlmAndRegex(extraction.llmFields, extraction.regexFields, doc.originalName);
      const modelUsed = this.determineModelUsed(extraction.llmFields, extraction.regexFields);

      record = await this.prisma.documentExtraction.update({
        where: { id: record.id },
        data: {
          documentType: classification.type,
          rawText: parsed.rawText,
          pages: parsed.pages as unknown as object,
          fields: merged as unknown as object,
          status: 'completed',
          modelUsed,
        },
      });

      return {
        documentId: doc.id,
        fileName: doc.originalName,
        documentType: classification.type,
        fields: merged,
        modelUsed,
        cacheStatus: 'live',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message, documentId: doc.id }, '[ExtractionPipeline] failed');
      await this.prisma.documentExtraction.update({
        where: { id: record.id },
        data: { status: 'failed', error: message },
      });
      throw err;
    }
  }

  async processMany(docs: PipelineDocumentInput[]): Promise<PipelineResult[]> {
    const results: PipelineResult[] = [];
    let cursor = 0;
    const workers: Array<Promise<void>> = [];

    const worker = async (): Promise<void> => {
      while (cursor < docs.length) {
        const idx = cursor++;
        const doc = docs[idx];
        try {
          const result = await this.processDocument(doc);
          results[idx] = result;
        } catch {
          results[idx] = {
            documentId: doc.id,
            fileName: doc.originalName,
            documentType: 'UNKNOWN',
            fields: {},
            modelUsed: 'regex',
            cacheStatus: 'live',
          };
        }
      }
    };

    for (let i = 0; i < Math.min(MAX_CONCURRENCY, docs.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    return results;
  }

  private async fetchAndParse(doc: PipelineDocumentInput): Promise<ParsedDocument> {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: doc.s3Key }),
    );
    if (!response.Body) throw new Error(`Empty body for ${doc.s3Key}`);

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    const contentType = response.ContentType ?? 'application/octet-stream';
    const parser = this.parsers.getParser(contentType);
    if (!parser) throw new Error(`No parser for content type: ${contentType}`);

    return parser.parse(body, doc.originalName, doc.id);
  }

  private async extract(
    fileName: string,
    documentType: DocumentType,
    rawText: string,
  ): Promise<{ llmFields: Record<string, ExtractedField> | null; regexFields: Record<string, ExtractedField> }> {
    const llmFields = await this.llm.extractFields(documentType, rawText, fileName);
    let regexFields: Record<string, ExtractedField> = {};
    const extractor = this.regex.getExtractor(documentType);
    if (extractor) {
      regexFields = extractor.extract(rawText, fileName);
    }
    return { llmFields, regexFields };
  }

  private mergeLlmAndRegex(
    llm: Record<string, ExtractedField> | null,
    regex: Record<string, ExtractedField>,
    fileName: string,
  ): Record<string, ExtractedField> {
    const merged: Record<string, ExtractedField> = { ...regex };
    if (llm) {
      for (const [key, field] of Object.entries(llm)) {
        if (!merged[key] || field.confidence > merged[key].confidence) {
          merged[key] = field;
        }
      }
    }
    for (const k of Object.keys(merged)) {
      if (!merged[k].source) merged[k].source = fileName;
    }
    return merged;
  }

  private determineModelUsed(
    llm: Record<string, ExtractedField> | null,
    regex: Record<string, ExtractedField>,
  ): PipelineResult['modelUsed'] {
    if (llm && Object.keys(regex).length > 0) return 'hybrid';
    if (llm) return 'cloudflare-llama3';
    return 'regex';
  }
}

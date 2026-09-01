import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../../config/storage.config.js';
import { PrismaClient } from '@prisma/client';
import { ParserRegistry } from './parsers/index.js';
import { OcrEngine } from './parsers/imageParser.js';
import { ExtractorRegistry } from './extractors/index.js';
import { classifyDocument, getFieldsForStep } from './classifier.js';
import {
  AutoFillResult,
  ExtractedField,
  ExtractionResult,
  ParsedDocument,
  WizardStep,
} from './types.js';

const prisma = new PrismaClient();

export class AutoFillService {
  private parserRegistry: ParserRegistry;
  private extractorRegistry: ExtractorRegistry;
  private s3Client: S3Client;
  private bucket: string;

  constructor(ocrEngine?: OcrEngine) {
    this.parserRegistry = new ParserRegistry(ocrEngine);
    this.extractorRegistry = new ExtractorRegistry();

    const config = getStorageConfig();
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
    this.bucket = config.bucket;
  }

  async autoFillStep(
    userId: string,
    applicationId: string,
    step: WizardStep,
    documentIds?: string[],
  ): Promise<AutoFillResult> {
    const documents = await this.getDocuments(userId, applicationId, documentIds);
    const extractionResults: ExtractionResult[] = [];

    for (const doc of documents) {
      try {
        const parsed = await this.retrieveAndParse(doc.s3Key, doc.originalName, doc.id);
        const extraction = this.extractFields(parsed, doc.originalName);
        extractionResults.push(extraction);
      } catch (error) {
        console.error(`Failed to process document ${doc.id}:`, error);
      }
    }

    return this.mergeExtractions(extractionResults, step);
  }

  async extractFromDocument(
    userId: string,
    documentId: string,
  ): Promise<ExtractionResult | null> {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId, status: { not: 'DELETED' } },
    });

    if (!doc) return null;

    const parsed = await this.retrieveAndParse(doc.s3Key, doc.originalName, doc.id);
    return this.extractFields(parsed, doc.originalName);
  }

  private async getDocuments(
    userId: string,
    applicationId: string,
    documentIds?: string[],
  ) {
    return prisma.document.findMany({
      where: {
        userId,
        applicationId,
        id: documentIds ? { in: documentIds } : undefined,
        status: { not: 'DELETED' },
      },
    });
  }

  private async retrieveAndParse(
    key: string,
    fileName: string,
    documentId: string,
  ): Promise<ParsedDocument> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty document body');
    }

    const chunks: Buffer[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    const contentType = response.ContentType || 'application/octet-stream';
    const parser = this.parserRegistry.getParser(contentType);

    if (!parser) {
      throw new Error(`No parser for content type: ${contentType}`);
    }

    return parser.parse(body, fileName, documentId);
  }

  private extractFields(parsed: ParsedDocument, fileName: string): ExtractionResult {
    const classification = classifyDocument(fileName, parsed.rawText);
    const extractor = this.extractorRegistry.getExtractor(classification.type);

    let fields: Record<string, ExtractedField> = {};
    if (extractor) {
      fields = extractor.extract(parsed.rawText, fileName);
    }

    return {
      documentId: parsed.documentId,
      fileName,
      documentType: classification.type,
      fields,
      rawText: parsed.rawText,
    };
  }

  private mergeExtractions(
    results: ExtractionResult[],
    step: WizardStep,
  ): AutoFillResult {
    const targetFields = getFieldsForStep(step);
    const extractedFields: Record<string, ExtractedField> = {};
    const unmatchedDocuments: string[] = [];

    for (const result of results) {
      let matched = false;

      for (const [fieldName, field] of Object.entries(result.fields) as [string, ExtractedField][]) {
        if (targetFields.includes(fieldName)) {
          matched = true;

          if (
            !extractedFields[fieldName] ||
            field.confidence > extractedFields[fieldName].confidence
          ) {
            extractedFields[fieldName] = field;
          }
        }
      }

      if (!matched) {
        unmatchedDocuments.push(result.fileName);
      }
    }

    const missingFields = targetFields.filter((f: string) => !extractedFields[f]);

    return {
      step,
      extractedFields,
      unmatchedDocuments,
      missingFields,
    };
  }
}

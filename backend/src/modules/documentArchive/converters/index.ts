import {
  ArchiveFormat,
  ArchiveAsset,
  ByteArchive,
} from '../types.js';

export interface ConvertContext {
  documentId: string;
  sourceKey: string;
  fileName: string;
  contentType: string;
  detectedContentType?: string;
  body: Buffer;
  sourceSize: number;
  sourceSha256: string;
  logger?: { warn: (msg: string) => void; info: (msg: string) => void };
}

export interface ArchiveBuild {
  format: ArchiveFormat;
  metadata: Record<string, unknown>;
  pages: Array<{
    pageNumber: number;
    width?: number;
    height?: number;
    blocks: Array<Record<string, unknown>>;
    ocr: { words: Array<Record<string, unknown>>; text: string } | null;
  }>;
  text: {
    rawText: string;
    charCount: number;
    searchable: boolean;
  };
  assets: ArchiveAsset[];
  byteArchive: ByteArchive;
  warnings: string[];
  classification?: {
    documentType: string;
    confidence: number;
  };
  fields?: Record<string, unknown>;
}

export interface ArchiveConverter {
  readonly supportedTypes: string[];
  convert(ctx: ConvertContext): Promise<ArchiveBuild>;
}

export class ArchiveConverterRegistry {
  private converters: ArchiveConverter[] = [];

  constructor(converters: ArchiveConverter[] = []) {
    this.converters = converters;
  }

  register(converter: ArchiveConverter): void {
    this.converters.push(converter);
  }

  getConverter(contentType: string): ArchiveConverter | undefined {
    const exact = this.converters.find((c) => c.supportedTypes.includes(contentType));
    if (exact) return exact;
    const fallback = this.converters.find((c) => c.supportedTypes.includes('*'));
    return fallback;
  }

  getSupportedTypes(): string[] {
    return this.converters.flatMap((c) => c.supportedTypes);
  }
}

import { PdfConverter } from './pdf.js';
import { DocxConverter } from './docx.js';
import { XlsxConverter } from './xlsx.js';
import { ImageConverter } from './image.js';
import { UnknownConverter } from './unknown.js';

export const DEFAULT_CONVERTERS: ArchiveConverter[] = [
  PdfConverter,
  DocxConverter,
  XlsxConverter,
  ImageConverter,
  UnknownConverter,
];

export { PdfConverter, DocxConverter, XlsxConverter, ImageConverter, UnknownConverter };

import { Extractor, PanCardExtractor } from './panExtractor.js';
import { AadhaarExtractor } from './aadhaarExtractor.js';
import { GstCertificateExtractor } from './gstExtractor.js';
import { ItrExtractor } from './itrExtractor.js';
import { BankStatementExtractor } from './bankStatementExtractor.js';
import { BalanceSheetExtractor } from './balanceSheetExtractor.js';
import { DocumentType } from '../types.js';

export class ExtractorRegistry {
  private extractors: Map<string, Extractor> = new Map();

  constructor() {
    this.register(new PanCardExtractor());
    this.register(new AadhaarExtractor());
    this.register(new GstCertificateExtractor());
    this.register(new ItrExtractor());
    this.register(new BankStatementExtractor());
    this.register(new BalanceSheetExtractor());
  }

  register(extractor: Extractor): void {
    this.extractors.set(extractor.documentType, extractor);
  }

  getExtractor(documentType: DocumentType): Extractor | undefined {
    return this.extractors.get(documentType);
  }

  allExtractors(): Extractor[] {
    return Array.from(this.extractors.values());
  }
}

export { PanCardExtractor, AadhaarExtractor, GstCertificateExtractor, ItrExtractor, BankStatementExtractor, BalanceSheetExtractor };

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseDocument } from './parsers.js';
import { extractKycFields } from './fieldExtractor.js';
import type { ExtractionResult, LocalExtractOptions, ExtractedKycData } from './types.js';

/**
 * Local Document Extraction Service
 * 
 * Self-contained, offline-first extraction of KYC data from documents.
 * No external APIs, no cloud dependencies - runs entirely on your infrastructure.
 * 
 * Supports: PDF, DOCX, XLSX, CSV, Images (OCR), ZIP archives
 */

export class LocalExtractService {
  private options: Required<LocalExtractOptions>;

  constructor(options: LocalExtractOptions = {}) {
    this.options = {
      tempDir: options.tempDir || os.tmpdir(),
      ocrLanguage: options.ocrLanguage || 'eng',
      debug: options.debug || false,
    };
  }

  /**
   * Extract KYC data from a single file
   */
  async extractFromFile(filePath: string): Promise<ExtractionResult> {
    const fileName = path.basename(filePath);

    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          fileName,
          data: null,
          errors: [`File not found: ${filePath}`],
        };
      }

      // Parse document to text
      const { text, pages } = await parseDocument(filePath, {
        ocrLanguage: this.options.ocrLanguage,
        debug: this.options.debug,
      });

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          fileName,
          data: null,
          errors: ['No text could be extracted from the document'],
        };
      }

      // Extract KYC fields
      const data = extractKycFields(text);

      return {
        success: true,
        fileName,
        data,
        errors: [],
      };
    } catch (error) {
      return {
        success: false,
        fileName,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown extraction error'],
      };
    }
  }

  /**
   * Extract KYC data from multiple files in a folder
   */
  async extractFromFolder(folderPath: string): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(folderPath, entry.name);
          const result = await this.extractFromFile(filePath);
          results.push(result);
        }
      }
    } catch (error) {
      results.push({
        success: false,
        fileName: folderPath,
        data: null,
        errors: [`Failed to read folder: ${error instanceof Error ? error.message : 'Unknown error'}`],
      });
    }

    return results;
  }

  /**
   * Extract from a buffer (for API uploads)
   */
  async extractFromBuffer(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
    // Write to temp file
    const tempPath = path.join(this.options.tempDir, `local_extract_${Date.now()}_${fileName}`);

    try {
      fs.writeFileSync(tempPath, buffer);
      const result = await this.extractFromFile(tempPath);
      return result;
    } finally {
      // Cleanup temp file
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }
  }

  /**
   * Merge extraction results from multiple documents
   * Prioritizes non-empty fields from each result
   */
  mergeResults(results: ExtractionResult[]): ExtractedKycData {
    const merged: ExtractedKycData = {
      documentType: 'UNKNOWN',
      fullName: '',
      dateOfBirth: '',
      gender: '',
      aadhaarNumber: '',
      vid: '',
      panNumber: '',
      fathersName: '',
      address: '',
      raw: {},
    };

    for (const result of results) {
      if (!result.success || !result.data) continue;

      const data = result.data;

      // Take first non-empty value for each field
      if (!merged.fullName && data.fullName) merged.fullName = data.fullName;
      if (!merged.dateOfBirth && data.dateOfBirth) merged.dateOfBirth = data.dateOfBirth;
      if (!merged.gender && data.gender) merged.gender = data.gender;
      if (!merged.aadhaarNumber && data.aadhaarNumber) merged.aadhaarNumber = data.aadhaarNumber;
      if (!merged.vid && data.vid) merged.vid = data.vid;
      if (!merged.panNumber && data.panNumber) merged.panNumber = data.panNumber;
      if (!merged.fathersName && data.fathersName) merged.fathersName = data.fathersName;
      if (!merged.address && data.address) merged.address = data.address;

      // Document type priority: AADHAAR > PAN > UNKNOWN
      if (data.documentType === 'AADHAAR') merged.documentType = 'AADHAAR';
      else if (data.documentType === 'PAN' && merged.documentType !== 'AADHAAR') merged.documentType = 'PAN';
    }

    return merged;
  }
}

// Singleton instance
let serviceInstance: LocalExtractService | null = null;

export function getLocalExtractService(options?: LocalExtractOptions): LocalExtractService {
  if (!serviceInstance) {
    serviceInstance = new LocalExtractService(options);
  }
  return serviceInstance;
}

export async function extractFromFiles(filePaths: string[]): Promise<ExtractionResult[]> {
  const service = getLocalExtractService();
  const results: ExtractionResult[] = [];

  for (const filePath of filePaths) {
    const result = await service.extractFromFile(filePath);
    results.push(result);
  }

  return results;
}

export async function extractFromFolder(folderPath: string): Promise<ExtractionResult[]> {
  const service = getLocalExtractService();
  return service.extractFromFolder(folderPath);
}

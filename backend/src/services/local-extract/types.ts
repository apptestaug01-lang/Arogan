import * as fs from 'fs';
import * as path from 'path';

export interface ExtractedKycData {
  documentType: 'AADHAAR' | 'PAN' | 'UNKNOWN';
  fullName: string;
  dateOfBirth: string;
  gender: string;
  aadhaarNumber: string;
  vid: string;
  panNumber: string;
  fathersName: string;
  address: string;
  raw: Record<string, string[]>;
}

export interface ExtractionResult {
  success: boolean;
  fileName: string;
  data: ExtractedKycData | null;
  errors: string[];
}

// Local extraction options
export interface LocalExtractOptions {
  tempDir?: string;
  ocrLanguage?: string;
  debug?: boolean;
}

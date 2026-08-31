import axios from 'axios';
import { validateEnv } from '../utils/env.validation.js';

const env = validateEnv();

export interface AzureExtractionResult {
  field: string;
  value: string;
  confidence: number;
  source: string;
}

// Field mappings from Azure Document Intelligence schema to our application fields
const AZURE_FIELD_MAPPINGS: Record<string, string> = {
  // Identity document fields
  'CountryRegion': '',
  'DocType': '',
  'DocumentNumber': 'aadhaar',  // For Aadhaar
  'DateOfBirth': '',
  'DateOfExpiration': '',
  'FirstName': 'fullName',
  'LastName': '',
  'MiddleName': '',
  'Nationality': '',
  'PersonalNumber': 'pan',  // For PAN
  'PlaceOfBirth': '',
  'Sex': '',

  // GST/CIN document fields
  'TaxId': 'gstin',
  'LegalName': 'companyName',
  'BusinessName': 'companyName',
  'RegistrationNumber': 'cin',
  'PanNumber': 'companyPan',

  // Bank statement fields
  'AccountNumber': '',
  'BankName': '',
  'StatementDate': 'bankStatementPeriod',
  'OpeningBalance': '',
  'ClosingBalance': '',
  'AverageBalance': 'avgMonthlyBalance',
};

/**
 * Extract document fields using Azure Document Intelligence
 * Uses pre-trained models for Indian documents (ID, GST, etc.)
 */
export async function extractWithAzureDocumentIntelligence(
  documentUrl: string,
  modelId: string = 'prebuilt-idDocument',
): Promise<AzureExtractionResult[]> {
  const endpoint = env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

  if (!endpoint || !key) {
    throw new Error('Azure Document Intelligence not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY.');
  }

  // Step 1: Submit document for analysis
  const submitUrl = `${endpoint}/documentintelligence/documentModels/${modelId}:analyze?api-version=2024-07-31-preview`;
  
  const submitResponse = await axios.post(
    submitUrl,
    { urlSource: documentUrl },
    {
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    },
  );

  // Get the operation location for polling
  const operationLocation = submitResponse.headers['operation-location'];
  if (!operationLocation) {
    throw new Error('No operation location returned from Azure');
  }

  // Step 2: Poll for results
  let result: any = null;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second intervals

    const pollResponse = await axios.get(operationLocation, {
      headers: {
        'Ocp-Apim-Subscription-Key': key,
      },
      timeout: 30_000,
    });

    const status = pollResponse.data?.status;
    if (status === 'succeeded') {
      result = pollResponse.data;
      break;
    }
    if (status === 'failed') {
      throw new Error(`Azure analysis failed: ${pollResponse.data?.error?.message || 'Unknown error'}`);
    }

    attempts++;
  }

  if (!result) {
    throw new Error('Azure analysis timed out');
  }

  // Step 3: Parse results
  const extractions: AzureExtractionResult[] = [];
  const documents = result.analyzeResult?.documents || [];

  for (const doc of documents) {
    const docType = doc.docType || 'unknown';
    const fields = doc.fields || {};

    for (const [fieldName, fieldData] of Object.entries(fields)) {
      const fieldInfo = fieldData as any;
      const value = fieldInfo?.content || fieldInfo?.valueString || fieldInfo?.valueNumber?.toString() || '';
      const confidence = fieldInfo?.confidence || 0;

      if (!value) continue;

      // Map Azure field name to our application field
      const appFieldName = AZURE_FIELD_MAPPINGS[fieldName];
      if (!appFieldName) continue;

      extractions.push({
        field: appFieldName,
        value: value,
        confidence: confidence,
        source: `azure_${docType}`,
      });
    }
  }

  return extractions;
}

/**
 * Extract from multiple document types using appropriate Azure models
 */
export async function extractWithAzureMultiModel(
  documents: Array<{ url: string; contentType: string; fileName: string }>,
): Promise<AzureExtractionResult[]> {
  const results: AzureExtractionResult[] = [];

  for (const doc of documents) {
    try {
      let modelId = 'prebuilt-layout'; // Default fallback

      // Select appropriate model based on document type/name
      const fileNameLower = doc.fileName.toLowerCase();
      if (fileNameLower.includes('pan') || fileNameLower.includes('aadhaar') || fileNameLower.includes('id')) {
        modelId = 'prebuilt-idDocument';
      } else if (fileNameLower.includes('gst') || fileNameLower.includes('invoice')) {
        modelId = 'prebuilt-invoice';
      } else if (fileNameLower.includes('bank') || fileNameLower.includes('statement')) {
        modelId = 'prebuilt-layout'; // Layout works for bank statements
      } else if (doc.contentType === 'application/pdf') {
        modelId = 'prebuilt-layout';
      }

      const docResults = await extractWithAzureDocumentIntelligence(doc.url, modelId);
      results.push(...docResults);
    } catch (error) {
      console.error(`Azure extraction failed for ${doc.fileName}:`, error);
      // Continue with other documents
    }
  }

  return results;
}

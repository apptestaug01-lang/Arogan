import { PrismaClient } from '@prisma/client';
import { AutoFillService } from '../modules/documentExtraction/autoFillService.js';

const prisma = new PrismaClient();

const USER_ID = 'cmt71ut1i0003y8k5uasqi587';
const APPLICATION_ID = 'LAP-2026-0184';

interface FieldResult {
  value: string | number | boolean | string[];
  confidence: number;
  source: string;
}

interface StepResult {
  step: string;
  step_label: string;
  fields_extracted: Record<string, FieldResult>;
  missing_fields: string[];
  unmatched_documents: string[];
}

interface ExtractionResult {
  application_id: string;
  extraction_timestamp: string;
  documents_processed: Array<{
    document_id: string;
    filename: string;
    document_type: string;
    fields_extracted: Record<string, FieldResult>;
  }>;
  wizard_steps: StepResult[];
  summary: {
    total_fields_extracted: number;
    total_missing_fields: number;
    documents_analyzed: number;
    extraction_confidence: number;
  };
}

async function extractAllToJson(): Promise<ExtractionResult> {
  const autoFillService = new AutoFillService();

  const documents = await prisma.document.findMany({
    where: { userId: USER_ID, applicationId: APPLICATION_ID, status: { not: 'DELETED' } },
  });

  const documentResults = [];
  for (const doc of documents) {
    try {
      const result = await autoFillService.extractFromDocument(USER_ID, doc.id);
      if (result) {
        documentResults.push({
          document_id: doc.id,
          filename: result.fileName,
          document_type: result.documentType,
          fields_extracted: result.fields,
        });
      }
    } catch (error) {
      console.error(`Failed to extract ${doc.id}:`, error);
    }
  }

  const steps = ['kyc', 'business', 'financials', 'loan'] as const;
  const stepLabels = {
    kyc: 'Personal & KYC',
    business: 'Business Details',
    financials: 'Financials',
    loan: 'Loan Request',
  };

  const stepResults: StepResult[] = [];
  for (const step of steps) {
    const result = await autoFillService.autoFillStep(USER_ID, APPLICATION_ID, step);
    stepResults.push({
      step,
      step_label: stepLabels[step],
      fields_extracted: result.extractedFields,
      missing_fields: result.missingFields,
      unmatched_documents: result.unmatchedDocuments,
    });
  }

  let totalFields = 0;
  let totalMissing = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const step of stepResults) {
    for (const field of Object.values(step.fields_extracted)) {
      totalFields++;
      totalConfidence += field.confidence;
      confidenceCount++;
    }
    totalMissing += step.missing_fields.length;
  }

  return {
    application_id: APPLICATION_ID,
    extraction_timestamp: new Date().toISOString(),
    documents_processed: documentResults,
    wizard_steps: stepResults,
    summary: {
      total_fields_extracted: totalFields,
      total_missing_fields: totalMissing,
      documents_analyzed: documents.length,
      extraction_confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    },
  };
}

async function main() {
  try {
    const result = await extractAllToJson();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

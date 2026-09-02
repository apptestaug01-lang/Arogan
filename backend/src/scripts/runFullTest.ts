import { PrismaClient } from '@prisma/client';
import { AutoFillService } from '../modules/documentExtraction/autoFillService.js';
import { ocrTextExtractor } from '../modules/documentExtraction/ocrTextExtractor.js';

const prisma = new PrismaClient();

const USER_ID = 'cmt71ut1i0003y8k5uasqi587';
const APPLICATION_ID = 'LAP-2026-0184';

const xlsDocuments = [
  {
    id: '42233227-77dc-4738-9258-4e5fc6daf63b',
    originalName: 'Pulse_FS_Dec-24_FY2024-25_06012025V6R.xls',
    contentType: 'application/vnd.ms-excel',
    s3Key: 'borrowers/cmt8kgoxm0000lk6jvlenbpex/applications/LAP-2026-0184/documents/42233227-77dc-4738-9258-4e5fc6daf63b/Pulse_FS_Dec-24_FY2024-25_06012025V6R.xls',
    size: 7350000,
  },
  {
    id: 'd0198c33-7036-4f4c-9b08-c38de488d63f',
    originalName: 'Pulse_FS_Mar-24_FY2024-25_03052025V2.xls',
    contentType: 'application/vnd.ms-excel',
    s3Key: 'borrowers/cmt8kgoxm0000lk6jvlenbpex/applications/LAP-2026-0184/documents/d0198c33-7036-4f4c-9b08-c38de488d63f/Pulse_FS_Mar-24_FY2024-25_03052025V2.xls',
    size: 6530000,
  },
  {
    id: 'ec9b1ffb-e876-4d95-a62c-f096d7b2f539',
    originalName: 'Pulse_pharma_Provisional_and_projection_financial_model_04032025.xls',
    contentType: 'application/vnd.ms-excel',
    s3Key: 'borrowers/cmt8kgoxm0000lk6jvlenbpex/applications/LAP-2026-0184/documents/ec9b1ffb-e876-4d95-a62c-f096d7b2f539/Pulse_pharma_Provisional_and_projection_financial_model_04032025.xls',
    size: 720000,
  },
];

async function registerXlsDocuments() {
  console.log('\n=== Registering XLS Documents in Database ===\n');

  for (const doc of xlsDocuments) {
    const existing = await prisma.document.findUnique({ where: { id: doc.id } });
    if (existing) {
      console.log(`  Already registered: ${doc.originalName}`);
      continue;
    }

    await prisma.document.create({
      data: {
        id: doc.id,
        userId: USER_ID,
        applicationId: APPLICATION_ID,
        category: 'Documents',
        originalName: doc.originalName,
        contentType: doc.contentType,
        s3Key: doc.s3Key,
        size: doc.size,
        checksum: 'test-checksum',
        status: 'UPLOADED',
      },
    });

    console.log(`  Registered: ${doc.originalName}`);
  }
}

async function testAutoFillSteps() {
  console.log('\n=== Testing Auto-Fill for Each Wizard Step ===\n');

  const autoFillService = new AutoFillService();
  const steps = ['kyc', 'business', 'financials', 'loan'] as const;

  for (const step of steps) {
    console.log(`\n--- Step: ${step.toUpperCase()} ---`);
    try {
      const result = await autoFillService.autoFillStep(USER_ID, APPLICATION_ID, step);

      console.log(`  Fields extracted: ${Object.keys(result.extractedFields).length}`);

      for (const [fieldName, field] of Object.entries(result.extractedFields)) {
        console.log(`    ${fieldName}: ${JSON.stringify(field.value)} (confidence: ${(field.confidence * 100).toFixed(0)}%, source: ${field.source})`);
      }

      if (result.unmatchedDocuments.length > 0) {
        console.log(`  Unmatched: ${result.unmatchedDocuments.join(', ')}`);
      }

      if (result.missingFields.length > 0) {
        console.log(`  Missing: ${result.missingFields.join(', ')}`);
      }
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function testSingleDocumentExtraction() {
  console.log('\n=== Testing Single Document Extraction ===\n');

  const autoFillService = new AutoFillService();

  for (const doc of xlsDocuments) {
    console.log(`\n--- ${doc.originalName} ---`);
    try {
      const result = await autoFillService.extractFromDocument(USER_ID, doc.id);
      if (result) {
        console.log(`  Type: ${result.documentType}`);
        console.log(`  Text length: ${result.rawText.length} chars`);
        console.log(`  Fields: ${Object.keys(result.fields).length}`);

        for (const [fieldName, field] of Object.entries(result.fields)) {
          console.log(`    ${fieldName}: ${JSON.stringify(field.value)} (${(field.confidence * 100).toFixed(0)}%)`);
        }

        const preview = result.rawText.substring(0, 300).replace(/\n/g, '\\n');
        console.log(`  Preview: ${preview}...`);
      }
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function testOcrTextExtractor() {
  console.log('\n=== Testing OCR Text Extractor (Aadhaar/PAN) ===\n');

  const aadhaarOcrText = `భారత ప్రభుత్వం
Government of India
Unique Identification Authority of India
...
To
కాట్రగడ్డ వెంకట రాంబాబు
Katragadda Venkata Rambabu
C/O Katragadda Sreeramulu Naidu
Villa No 17 Ektha Prime Highland Park
Financial District
Nanakramguda
Near Continental Hospital
Gachibowli
K.V. Rangareddy Telangana - 500032
9849988801
...
మీ ఆధార్ సంఖ్య / Your Aadhaar No. :
6802 8815 9512
VID : 9180 6014 5588 3830`;

  const panOcrText = `INCOME TAX DEPARTMENT
GOVT OF INDIA

Permanent Account Name
Name: KATRAGADDA VENKATA RAMBABU
Father's Name: KATRAGADDA SREERAMULU NAIDU
Date of Birth: 15/03/1985
Permanent Account Number: ACRJY0007D
Generated on: 01/01/2024`;

  console.log('\n--- Aadhaar Card OCR ---');
  const aadhaarResult = ocrTextExtractor.extractFromText(aadhaarOcrText, 'KV_RAM_BABU_AADHAR.pdf');
  console.log(JSON.stringify(aadhaarResult, null, 2));

  console.log('\n--- PAN Card OCR ---');
  const panResult = ocrTextExtractor.extractFromText(panOcrText, 'KV_RAM_BABU_PAN.pdf');
  console.log(JSON.stringify(panResult, null, 2));
}

async function main() {
  try {
    await registerXlsDocuments();
    await testSingleDocumentExtraction();
    await testAutoFillSteps();
    await testOcrTextExtractor();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

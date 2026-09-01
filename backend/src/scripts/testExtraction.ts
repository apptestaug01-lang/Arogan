import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import { PrismaClient } from '@prisma/client';
import { AutoFillService } from '../modules/documentExtraction/autoFillService.js';
import { ExtractedField, ExtractionResult } from '../modules/documentExtraction/types.js';

const prisma = new PrismaClient();
const args = process.argv.slice(2);

async function listBucketDocuments(searchPrefix: string = '') {
  const config = getStorageConfig();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });

  console.log('\n=== Listing documents in B2 bucket ===');
  console.log(`Endpoint: ${config.endpoint}`);
  console.log(`Bucket: ${config.bucket}`);
  if (searchPrefix) console.log(`Filter: ${searchPrefix}\n`);

  let continuationToken: string | undefined;
  let totalFiles = 0;
  const allKeys: string[] = [];

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && !obj.Key.endsWith('/')) {
          allKeys.push(obj.Key);
          totalFiles++;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  const filtered = searchPrefix ? allKeys.filter((k) => k.includes(searchPrefix)) : allKeys;

  for (const key of filtered) {
    console.log(`  ${key}`);
  }

  console.log(`\nTotal files: ${totalFiles}, Showing: ${filtered.length}`);
  return totalFiles;
}

async function testDatabaseDocuments() {
  console.log('\n=== Documents in Database ===\n');

  const documents = await prisma.document.findMany({
    where: { status: { not: 'DELETED' } },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (documents.length === 0) {
    console.log('  No documents found in database.');
    return [];
  }

  for (const doc of documents) {
    const sizeMB = (doc.size || 0) / (1024 * 1024);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Name: ${doc.originalName}`);
    console.log(`  Type: ${doc.contentType}`);
    console.log(`  Size: ${sizeMB.toFixed(2)} MB`);
    console.log(`  User: ${doc.user?.email || doc.userId}`);
    console.log(`  Application: ${doc.applicationId}`);
    console.log(`  S3 Key: ${doc.s3Key}`);
    console.log(`  Status: ${doc.status}`);
    console.log(`  Created: ${doc.createdAt}`);
    console.log('  ---');
  }

  return documents;
}

async function testExtraction(documentId?: string) {
  console.log('\n=== Testing Document Extraction ===\n');

  const autoFillService = new AutoFillService();
  const testUserId = 'cmt71ut1i0003y8k5uasqi587';
  const testUserId2 = 'cmt8kgoxm0000lk6jvlenbpex';
  const testUserId3 = 'cmta1xdq800071138pn5awuvx';
  const testApplicationId = 'LAP-2026-0184';

  if (documentId) {
    console.log(`Extracting single document: ${documentId}\n`);
    let result = await autoFillService.extractFromDocument(testUserId, documentId);
    if (!result) {
      result = await autoFillService.extractFromDocument(testUserId2, documentId);
    }
    if (!result) {
      result = await autoFillService.extractFromDocument(testUserId3, documentId);
    }
    if (result) {
      printExtractionResult(result);
    } else {
      console.log('  Document not found.');
    }
  } else {
    console.log('Testing auto-fill for each wizard step...\n');

    const steps = ['kyc', 'business', 'financials', 'loan'] as const;
    const users = [testUserId, testUserId2, testUserId3];

    for (const step of steps) {
      console.log(`\n--- Step: ${step.toUpperCase()} ---`);
      try {
        for (const userId of users) {
          const result = await autoFillService.autoFillStep(userId, testApplicationId, step);
          if (result && Object.keys(result.extractedFields).length > 0) {
            printAutoFillResult(result);
            break;
          }
        }
      } catch (error) {
        console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}

function printExtractionResult(result: ExtractionResult) {
  console.log(`  Document: ${result.fileName}`);
  console.log(`  Type: ${result.documentType}`);
  console.log(`  Fields extracted: ${Object.keys(result.fields).length}`);

  for (const [fieldName, field] of Object.entries(result.fields)) {
    console.log(`    ${fieldName}: ${JSON.stringify(field.value)} (confidence: ${(field.confidence * 100).toFixed(0)}%)`);
  }

  console.log(`  Raw text length: ${result.rawText?.length || 0}`);
  if (result.rawText) {
    const preview = result.rawText.substring(0, 1000).replace(/\n/g, '\\n');
    console.log(`  Text preview: ${preview}`);
  } else {
    console.log('  No text extracted');
  }
}

function printAutoFillResult(result: {
  step: string;
  extractedFields: Record<string, ExtractedField>;
  unmatchedDocuments: string[];
  missingFields: string[];
}) {
  console.log(`  Step: ${result.step}`);
  console.log(`  Fields extracted: ${Object.keys(result.extractedFields).length}`);

  for (const [fieldName, field] of Object.entries(result.extractedFields)) {
    console.log(`    ${fieldName}: ${JSON.stringify(field.value)} (confidence: ${(field.confidence * 100).toFixed(0)}%, source: ${field.source})`);
  }

  if (result.unmatchedDocuments.length > 0) {
    console.log(`  Unmatched documents: ${result.unmatchedDocuments.join(', ')}`);
  }

  if (result.missingFields.length > 0) {
    console.log(`  Missing fields: ${result.missingFields.join(', ')}`);
  }
}

async function main() {
  const command = args[0] || 'all';
  const param = args[1];

  try {
    switch (command) {
      case 'list':
        await listBucketDocuments(param);
        break;
      case 'db':
        await testDatabaseDocuments();
        break;
      case 'extract':
        await testExtraction(param);
        break;
      case 'all':
      default:
        await listBucketDocuments();
        await testDatabaseDocuments();
        await testExtraction(param);
        break;
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

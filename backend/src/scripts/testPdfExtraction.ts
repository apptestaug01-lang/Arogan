import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import pdf from 'pdf-parse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPdfExtraction(documentId: string) {
  console.log(`\n=== Testing PDF Extraction for ${documentId} ===\n`);

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

  const doc = await prisma.document.findFirst({
    where: { id: documentId, status: { not: 'DELETED' } },
  });

  if (!doc) {
    console.log('Document not found');
    return;
  }

  console.log(`Document: ${doc.originalName}`);
  console.log(`S3 Key: ${doc.s3Key}`);
  console.log(`Content Type: ${doc.contentType}`);
  console.log(`Size: ${doc.size} bytes`);

  const command = new GetObjectCommand({ Bucket: config.bucket, Key: doc.s3Key });
  const response = await client.send(command);

  if (!response.Body) {
    console.log('Empty document body');
    return;
  }

  const chunks: Buffer[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);

  console.log(`\nDownloaded ${body.length} bytes`);

  try {
    const data = await pdf(body);
    console.log(`\nPDF Info:`);
    console.log(`  Pages: ${data.numpages}`);
    console.log(`  Text length: ${data.text?.length || 0}`);
    console.log(`  Is PDF encrypted: ${data.info?.IsAcroFormPresent || false}`);

    if (data.text && data.text.trim().length > 10) {
      console.log(`\nText content (first 2000 chars):`);
      console.log('---');
      console.log(data.text.substring(0, 2000));
      console.log('---');
    } else {
      console.log(`\nNo meaningful text extracted. PDF may be image-based (scanned).`);
      console.log(`Raw text: "${data.text?.substring(0, 100)}"`);
    }
  } catch (error) {
    console.error('PDF parse error:', error);
  }
}

async function main() {
  const documentId = process.argv[2] || '113162bb-98df-4dda-bd2f-8e80a4d641b8';
  await testPdfExtraction(documentId);
  await prisma.$disconnect();
}

main();

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testWithTesseract(documentId: string) {
  console.log(`\n=== Testing OCR Extraction for ${documentId} ===\n`);

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

  console.log(`Downloaded ${body.length} bytes`);

  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-test-'));
  const pdfPath = path.join(tmpDir, 'document.pdf');

  try {
    await fs.writeFile(pdfPath, body);

    console.log('\nAttempting PDF to PNG conversion with pdf2pic...');

    try {
      const { fromPath } = await import('pdf2pic');
      const convert = fromPath(pdfPath, {
        density: 300,
        format: 'png',
        width: 2480,
        height: 3508,
      });

      const results = await convert.bulk(-1, { responseType: 'image' });
      console.log(`Converted ${results.length} pages to images`);

      const Tesseract = await import('tesseract.js');

      let fullText = '';
      for (let i = 0; i < results.length; i++) {
        const imgPath: string = results[i].path as string;
        console.log(`\nRunning OCR on page ${i + 1}...`);

        const { data } = await Tesseract.recognize(imgPath, 'eng', {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              process.stdout.write(`\r  Progress: ${(m.progress * 100).toFixed(0)}%`);
            }
          },
        });

        console.log(`\n  Page ${i + 1} OCR confidence: ${data.confidence.toFixed(1)}%`);
        console.log(`  Page ${i + 1} text length: ${data.text.length}`);
        fullText += data.text + '\n\n';

        await fs.unlink(imgPath).catch(() => {});
      }

      console.log(`\n\n=== Full Extracted Text (${fullText.length} chars) ===`);
      console.log('---');
      console.log(fullText.substring(0, 3000));
      console.log('---');

      console.log('\n=== Pattern Matching ===');

      const panMatch = fullText.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
      console.log(`PAN: ${panMatch ? panMatch[0] : 'Not found'}`);

      const nameMatch = fullText.match(/Name\s*[:\n]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
      console.log(`Name: ${nameMatch ? nameMatch[1] : 'Not found'}`);

      const dobMatch = fullText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
      console.log(`DOB: ${dobMatch ? dobMatch[1] : 'Not found'}`);

      if (/Income\s*Tax\s*Department/i.test(fullText)) {
        console.log('Document type: PAN Card (detected by keyword)');
      }
      if (/Aadhaar/i.test(fullText) || /Unique\s*Identification/i.test(fullText)) {
        console.log('Document type: Aadhaar Card (detected by keyword)');
      }
    } catch (error) {
      console.error('\npdf2pic not available:', error instanceof Error ? error.message : 'Unknown error');
    console.log('\nTrying direct tesseract on PDF bytes...');

    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng');
      const { data } = await worker.recognize(body);
      console.log(`OCR confidence: ${data.confidence.toFixed(1)}%`);
      console.log(`Text length: ${data.text.length}`);
      console.log('\nExtracted text:');
      console.log(data.text.substring(0, 2000));
      await worker.terminate();
    } catch (ocrError) {
      console.error('Direct OCR failed:', ocrError instanceof Error ? ocrError.message : 'Unknown error');
    }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const documentId = process.argv[2] || '113162bb-98df-4dda-bd2f-8e80a4d641b8';
  await testWithTesseract(documentId);
  await prisma.$disconnect();
}

main();

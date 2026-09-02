import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import { PrismaClient } from '@prisma/client';
import { writeFile, stat, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';

const prisma = new PrismaClient();

async function testPanPreprocessing(documentId: string) {
  const config = getStorageConfig();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true,
  });

  const doc = await prisma.document.findFirst({ where: { id: documentId, status: { not: 'DELETED' } } });
  if (!doc) { console.log('Document not found'); return; }

  console.log(`\n=== Test PAN Preprocessing: ${doc.originalName} ===`);

  const command = new GetObjectCommand({ Bucket: config.bucket, Key: doc.s3Key });
  const response = await client.send(command);
  if (!response.Body) { console.log('Empty body'); return; }

  const chunks: Buffer[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) { chunks.push(Buffer.from(chunk)); }
  const body = Buffer.concat(chunks);

  const tmpDir = join(tmpdir(), 'pan-preprocess');
  await mkdir(tmpDir, { recursive: true });

  const pdfPath = join(tmpDir, 'pan.pdf');
  await writeFile(pdfPath, body);

  const pdftoppmPath = 'C:\\Users\\mamil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\\poppler-25.07.0\\Library\\bin\\pdftoppm.exe';

  console.log('Converting with sharp (grayscale, resized, enhanced)...');
  const sharp = await import('sharp');

  const imgPath = `${pdfPath}.png`;
  const proc: ChildProcess = spawn(pdftoppmPath, ['-png', '-r', '300', '-f', '1', '-l', '1', pdfPath, join(tmpDir, 'page')]);
  await new Promise<void>((resolve) => proc.on('close', () => resolve()));

  const originalImg = `${join(tmpDir, 'page')}-1.png`;

  // Try different preprocessing options
  const preprocessOptions = [
    { name: 'grayscale', transform: () => sharp.default(originalImg).grayscale() },
    { name: 'normalize', transform: () => sharp.default(originalImg).normalize() },
    { name: 'resize_2x', transform: () => sharp.default(originalImg).resize(5100, 7026) },
    { name: 'threshold', transform: () => sharp.default(originalImg).grayscale().threshold(128) },
    { name: 'sharpen', transform: () => sharp.default(originalImg).sharpen() },
  ];

  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');

  for (const option of preprocessOptions) {
    console.log(`\n--- Trying: ${option.name} ---`);
    try {
      const processedPath = join(tmpDir, `${option.name}.png`);
      await option.transform().png().toFile(processedPath);

      const { data } = await worker.recognize(processedPath);
      console.log(`Confidence: ${data.confidence.toFixed(1)}%`);
      if (data.text.trim()) {
        console.log(`Text:\n${data.text.substring(0, 500)}`);
      }
    } catch (e) {
      console.log('Error:', e instanceof Error ? e.message : 'Unknown');
    }
  }

  await worker.terminate();
}

async function main() {
  try {
    await testPanPreprocessing('113162bb-98df-4dda-bd2f-8e80a4d641b8');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

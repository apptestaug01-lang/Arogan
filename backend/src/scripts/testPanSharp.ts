import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import { PrismaClient } from '@prisma/client';
import { writeFile, stat, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';

const prisma = new PrismaClient();

async function testPanWithSharp(documentId: string) {
  const config = getStorageConfig();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true,
  });

  const doc = await prisma.document.findFirst({ where: { id: documentId, status: { not: 'DELETED' } } });
  if (!doc) { console.log('Document not found'); return; }

  console.log(`\n=== Test PAN with Sharp: ${doc.originalName} ===`);

  const command = new GetObjectCommand({ Bucket: config.bucket, Key: doc.s3Key });
  const response = await client.send(command);
  if (!response.Body) { console.log('Empty body'); return; }

  const chunks: Buffer[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) { chunks.push(Buffer.from(chunk)); }
  const body = Buffer.concat(chunks);

  const tmpDir = join(tmpdir(), 'pan-sharp');
  await mkdir(tmpDir, { recursive: true });

  const pdfPath = join(tmpDir, 'pan.pdf');
  await writeFile(pdfPath, body);

  const pdftoppmPath = 'C:\\Users\\mamil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\\poppler-25.07.0\\Library\\bin\\pdftoppm.exe';

  const outputPrefix = join(tmpDir, 'page');

  const proc: ChildProcess = spawn(pdftoppmPath, ['-png', '-r', '300', pdfPath, outputPrefix]);
  await new Promise<void>((resolve) => proc.on('close', () => resolve()));

  const imgPath = `${outputPrefix}-1.png`;
  const imgStat = await stat(imgPath);
  console.log(`Original image size: ${imgStat.size} bytes`);

  console.log('\n--- Converting with sharp ---');
  const sharp = await import('sharp');

  const convertedPath = join(tmpDir, 'converted.jpg');
  await sharp.default(imgPath)
    .jpeg({ quality: 90 })
    .toFile(convertedPath);

  const convertedStat = await stat(convertedPath);
  console.log(`Converted JPEG size: ${convertedStat.size} bytes`);

  console.log('\n--- OCR on converted JPEG ---');
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');

  const { data } = await worker.recognize(convertedPath);
  console.log(`Confidence: ${data.confidence.toFixed(1)}%`);
  console.log(`Text:\n${data.text}`);

  await worker.terminate();

  console.log('\n\n=== Pattern Matching ===');
  const panMatch = data.text.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
  console.log(`PAN: ${panMatch ? panMatch[0] : 'Not found'}`);

  const nameMatch = data.text.match(/Name[:\s]+([A-Za-z\s]+)/i);
  console.log(`Name: ${nameMatch ? nameMatch[1] : 'Not found'}`);

  const dobMatch = data.text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
  console.log(`DOB: ${dobMatch ? dobMatch[1] : 'Not found'}`);
}

async function main() {
  try {
    await testPanWithSharp('113162bb-98df-4dda-bd2f-8e80a4d641b8');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

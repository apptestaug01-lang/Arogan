import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import { PrismaClient } from '@prisma/client';
import { writeFile, rm, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';
import { stat } from 'fs/promises';

const prisma = new PrismaClient();

async function findPdftoppm(): Promise<string> {
  const paths = [
    'C:\\Users\\mamil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\\poppler-25.07.0\\Library\\bin\\pdftoppm.exe',
    'pdftoppm',
  ];
  for (const p of paths) {
    try { await stat(p); return p; } catch { continue; }
  }
  return 'pdftoppm';
}

async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'pan-ocr-'));
  const outputPrefix = join(tmpDir, 'page');
  const pdftoppmPath = await findPdftoppm();

  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn(pdftoppmPath, ['-png', '-r', '300', pdfPath, outputPrefix]);
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', async (code: number) => {
      if (code !== 0) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`pdftoppm failed: ${stderr}`));
        return;
      }
      const images: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const imgPath = `${outputPrefix}-${i}.png`;
        try {
          await stat(imgPath);
          images.push(imgPath);
        } catch { break; }
      }
      resolve(images);
    });
    proc.on('error', (err) => reject(err));
  });
}

async function testPanOcr(documentId: string) {
  const config = getStorageConfig();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true,
  });

  const doc = await prisma.document.findFirst({ where: { id: documentId, status: { not: 'DELETED' } } });
  if (!doc) { console.log('Document not found'); return; }

  console.log(`\n=== Testing PAN OCR: ${doc.originalName} ===`);

  const command = new GetObjectCommand({ Bucket: config.bucket, Key: doc.s3Key });
  const response = await client.send(command);
  if (!response.Body) { console.log('Empty body'); return; }

  const chunks: Buffer[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) { chunks.push(Buffer.from(chunk)); }
  const body = Buffer.concat(chunks);

  const tmpDir = await mkdtemp(join(tmpdir(), 'pan-ocr-'));
  const pdfPath = join(tmpDir, 'pan.pdf');

  try {
    await writeFile(pdfPath, body);
    console.log(`PDF size: ${body.length} bytes`);

    const images = await convertPdfToImages(pdfPath);
    console.log(`Converted to ${images.length} images`);

    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');

    let fullText = '';
    for (let i = 0; i < images.length; i++) {
      console.log(`\n--- OCR on page ${i + 1} ---`);
      const { data } = await worker.recognize(images[i]);
      console.log(`Confidence: ${data.confidence.toFixed(1)}%`);
      console.log(`Text:\n${data.text}`);
      fullText += data.text + '\n';
    }

    await worker.terminate();

    console.log(`\n\n=== FULL EXTRACTED TEXT ===`);
    console.log(fullText);

    console.log(`\n\n=== Pattern Matching ===`);
    const panMatch = fullText.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
    console.log(`PAN: ${panMatch ? panMatch[0] : 'Not found'}`);

    const nameMatch = fullText.match(/Name\s*[:\n]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    console.log(`Name: ${nameMatch ? nameMatch[1] : 'Not found'}`);

    const fatherMatch = fullText.match(/Father'?s?\s*Name\s*[:\n]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    console.log(`Father: ${fatherMatch ? fatherMatch[1] : 'Not found'}`);

    const dobMatch = fullText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    console.log(`DOB: ${dobMatch ? dobMatch[1] : 'Not found'}`);

    if (/Income\s*Tax/i.test(fullText)) console.log('Document type: PAN Card (by keyword)');
    if (/Permanent\s*Account/i.test(fullText)) console.log('Document type: PAN Card (by keyword)');

  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    await testPanOcr('113162bb-98df-4dda-bd2f-8e80a4d641b8');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

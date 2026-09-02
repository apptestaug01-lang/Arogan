import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import { PrismaClient } from '@prisma/client';
import { writeFile, stat, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';

const prisma = new PrismaClient();

async function testPanImageDebug(documentId: string) {
  const config = getStorageConfig();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true,
  });

  const doc = await prisma.document.findFirst({ where: { id: documentId, status: { not: 'DELETED' } } });
  if (!doc) { console.log('Document not found'); return; }

  console.log(`\n=== Debug PAN Image: ${doc.originalName} ===`);

  const command = new GetObjectCommand({ Bucket: config.bucket, Key: doc.s3Key });
  const response = await client.send(command);
  if (!response.Body) { console.log('Empty body'); return; }

  const chunks: Buffer[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) { chunks.push(Buffer.from(chunk)); }
  const body = Buffer.concat(chunks);

  const tmpDir = join(tmpdir(), 'pan-debug-final');
  await mkdir(tmpDir, { recursive: true });

  const pdfPath = join(tmpDir, 'pan.pdf');
  await writeFile(pdfPath, body);

  const pdftoppmPath = 'C:\\Users\\mamil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\\poppler-25.07.0\\Library\\bin\\pdftoppm.exe';

  const outputPrefix = join(tmpDir, 'page');

  const proc: ChildProcess = spawn(pdftoppmPath, ['-png', '-r', '300', pdfPath, outputPrefix]);

  let stderr = '';
  proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

  await new Promise<void>((resolve, reject) => {
    proc.on('close', (code: number) => {
      console.log(`pdftoppm exit code: ${code}`);
      if (stderr) console.log(`stderr: ${stderr}`);
      resolve();
    });
    proc.on('error', reject);
  });

  const imgPath = `${outputPrefix}-1.png`;
  const imgStat = await stat(imgPath);
  console.log(`Image file size: ${imgStat.size} bytes`);

  const imgBuffer = await readFile(imgPath);
  const width = imgBuffer.readUInt32BE(16);
  const height = imgBuffer.readUInt32BE(20);
  console.log(`PNG dimensions: ${width}x${height}`);

  console.log('\n--- OCR with file buffer ---');
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');

  try {
    const { data } = await worker.recognize(imgBuffer);
    console.log(`Confidence: ${data.confidence.toFixed(1)}%`);
    console.log(`Text:\n${data.text}`);
  } catch (e) {
    console.log('OCR error:', e);
  }

  await worker.terminate();

  console.log('\n--- Trying pdftocairo ---');
  const cairoPath = join(tmpDir, 'cairo');
  const cairoProc: ChildProcess = spawn('pdftocairo', ['-png', '-r', '300', '-f', '1', '-l', '1', pdfPath, cairoPath]);
  let cairoStderr = '';
  cairoProc.stderr?.on('data', (d: Buffer) => { cairoStderr += d.toString(); });
  await new Promise<void>((resolve) => {
    cairoProc.on('close', (code: number) => {
      console.log(`pdftocairo exit code: ${code}`);
      resolve();
    });
    cairoProc.on('error', (err) => {
      console.log(`pdftocairo error: ${err.message}`);
      resolve();
    });
  });

  const cairoImgPath = join(tmpDir, 'cairo-1.png');
  try {
    const cairoStat = await stat(cairoImgPath);
    console.log(`Cairo image size: ${cairoStat.size} bytes`);

    const cairoBuffer = await readFile(cairoImgPath);
    const cairoWidth = cairoBuffer.readUInt32BE(16);
    const cairoHeight = cairoBuffer.readUInt32BE(20);
    console.log(`Cairo PNG dimensions: ${cairoWidth}x${cairoHeight}`);

    const worker2 = await Tesseract.createWorker('eng');
    const { data } = await worker2.recognize(cairoBuffer);
    console.log(`Cairo OCR Confidence: ${data.confidence.toFixed(1)}%`);
    console.log(`Cairo OCR Text:\n${data.text}`);
    await worker2.terminate();
  } catch (e) {
    console.log('Cairo image not found or OCR error:', e instanceof Error ? e.message : 'Unknown');
  }
}

async function main() {
  try {
    await testPanImageDebug('113162bb-98df-4dda-bd2f-8e80a4d641b8');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

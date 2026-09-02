import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import * as XLSX from 'xlsx';

async function analyzeXlsStructure() {
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

  const keys = [
    'borrowers/cmt8kgoxm0000lk6jvlenbpex/applications/LAP-2026-0184/documents/42233227-77dc-4738-9258-4e5fc6daf63b/Pulse_FS_Dec-24_FY2024-25_06012025V6R.xls',
    'borrowers/cmt8kgoxm0000lk6jvlenbpex/applications/LAP-2026-0184/documents/d0198c33-7036-4f4c-9b08-c38de488d63f/Pulse_FS_Mar-24_FY2024-25_03052025V2.xls',
    'borrowers/cmt8kgoxm0000lk6jvlenbpex/applications/LAP-2026-0184/documents/ec9b1ffb-e876-4d95-a62c-f096d7b2f539/Pulse_pharma_Provisional_and_projection_financial_model_04032025.xls',
  ];

  for (const key of keys) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`FILE: ${key.split('/').pop()}`);
    console.log('='.repeat(80));

    const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
    const response = await client.send(command);

    if (!response.Body) continue;

    const chunks: Buffer[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    const workbook = XLSX.read(body, { type: 'buffer' });

    for (const sheetName of workbook.SheetNames) {
      console.log(`\n--- Sheet: ${sheetName} ---`);
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

      console.log(`Rows: ${jsonData.length}`);

      for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
        const row = jsonData[i] as unknown[];
        const rowStr = row.map((cell) => String(cell ?? '').substring(0, 30)).join(' | ');
        console.log(`  Row ${i}: ${rowStr}`);
      }
    }
  }
}

analyzeXlsStructure().catch(console.error);

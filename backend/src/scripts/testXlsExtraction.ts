import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';
import * as XLSX from 'xlsx';

async function testXlsExtraction() {
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

  const key = 'borrowers/cmt8kgoxm0000lk6jvlenbpex/applications/LAP-2026-0184/documents/42233227-77dc-4738-9258-4e5fc6daf63b/Pulse_FS_Dec-24_FY2024-25_06012025V6R.xls';

  console.log(`\n=== Testing XLS Extraction ===\n`);
  console.log(`Key: ${key}\n`);

  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
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

  const workbook = XLSX.read(body, { type: 'buffer' });
  console.log(`\nSheets: ${workbook.SheetNames.join(', ')}`);

  const fullText: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    console.log(`\n=== Sheet: ${sheetName} ===`);

    const csvData = XLSX.utils.sheet_to_csv(sheet);
    console.log(`\nCSV Data (first 2000 chars):`);
    console.log(csvData.substring(0, 2000));

    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    console.log(`\nJSON Data (first 50 rows):`);
    console.log(JSON.stringify(jsonData.slice(0, 50), null, 2));

    fullText.push(`=== Sheet: ${sheetName} ===\n${csvData}\n${JSON.stringify(jsonData, null, 2)}`);
  }

  const allText = fullText.join('\n\n');

  console.log(`\n\n=== Pattern Matching ===`);

  const turnoverMatch = allText.match(/(?:Turnover|Revenue|Sales)[:\s]*₹?\s*([\d,.]+)\s*(Crore|Lakh|Cr|Lac)?/i);
  console.log(`Turnover: ${turnoverMatch ? turnoverMatch[0] : 'Not found'}`);

  const profitMatch = allText.match(/(?:Profit|PAT|Net Income)[:\s]*₹?\s*([\d,.]+)\s*(Crore|Lakh|Cr|Lac)?/i);
  console.log(`Profit: ${profitMatch ? profitMatch[0] : 'Not found'}`);

  const panMatch = allText.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
  console.log(`PAN: ${panMatch ? panMatch[0] : 'Not found'}`);

  const companyMatch = allText.match(/(?:Company|Business|Name)[:\s]*([A-Za-z\s]+)/i);
  console.log(`Company: ${companyMatch ? companyMatch[1] : 'Not found'}`);
}

testXlsExtraction().catch(console.error);

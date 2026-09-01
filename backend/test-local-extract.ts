import * as path from 'path';
import { LocalExtractService } from './src/services/local-extract/index.js';

async function testExtraction() {
  const service = new LocalExtractService({ debug: true });

  const testFiles = [
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\KV RAM BABU AADHAR.pdf',
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\KV RAM BABU PAN.pdf',
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\Suresh Babu PAN.pdf',
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\SURESH_BABU_AAdhaar.pdf',
  ];

  console.log('=== LOCAL DOCUMENT EXTRACTION TEST ===\n');

  const results = [];

  for (const filePath of testFiles) {
    console.log(`\n--- Testing: ${path.basename(filePath)} ---`);

    const result = await service.extractFromFile(filePath);
    results.push(result);

    if (result.success && result.data) {
      console.log('✅ SUCCESS');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ FAILED');
      console.log('Errors:', result.errors);
    }
  }

  console.log('\n\n=== MERGED RESULT ===');
  const merged = service.mergeResults(results);
  console.log(JSON.stringify(merged, null, 2));
}

testExtraction().catch(console.error);

import * as fs from 'fs';
import * as path from 'path';
import { extractWithAzureMultiModel } from './src/services/azureDocument.service.js';

async function testAzureExtraction() {
  const testFiles = [
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\KV RAM BABU AADHAR.pdf',
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\KV RAM BABU PAN.pdf',
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\Suresh Babu PAN.pdf',
    'C:\\Users\\mamil\\OneDrive\\Desktop\\23-Aug-26\\Pulse Pharma\\KYC\\SURESH_BABU_AAdhaar.pdf',
  ];

  console.log('=== AZURE DOCUMENT INTELLIGENCE TEST ===\n');

  // Check if Azure is configured
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

  if (!endpoint || !key) {
    console.log('❌ Azure Document Intelligence not configured');
    console.log('');
    console.log('To set up:');
    console.log('1. Go to https://portal.azure.com');
    console.log('2. Create a "Document Intelligence" resource');
    console.log('3. Get the Endpoint and Key from the resource');
    console.log('4. Set environment variables:');
    console.log('   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com');
    console.log('   AZURE_DOCUMENT_INTELLIGENCE_KEY=<your-key>');
    console.log('');
    console.log('Free tier: 1000 pages/month');
    return;
  }

  // Read files and convert to base64 for Azure
  const documents = testFiles.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    return {
      url: `data:${getContentType(path.extname(filePath))};base64,${buffer.toString('base64')}`,
      contentType: getContentType(path.extname(filePath)),
      fileName: path.basename(filePath),
    };
  });

  console.log('Sending documents to Azure Document Intelligence...\n');

  try {
    const results = await extractWithAzureMultiModel(documents);

    console.log('=== RESULTS ===\n');
    for (const result of results) {
      console.log(`Field: ${result.field}`);
      console.log(`Value: ${result.value}`);
      console.log(`Confidence: ${result.confidence}`);
      console.log(`Source: ${result.source}`);
      console.log('---');
    }

    // Group by document
    const byDoc: Record<string, typeof results> = {};
    for (const r of results) {
      const docName = r.source.replace(/^.+_/, '') || 'unknown';
      if (!byDoc[docName]) byDoc[docName] = [];
      byDoc[docName].push(r);
    }

    console.log('\n=== GROUPED BY DOCUMENT ===\n');
    for (const [docName, fields] of Object.entries(byDoc)) {
      console.log(`\n--- ${docName} ---`);
      for (const f of fields) {
        console.log(`  ${f.field}: ${f.value} (${Math.round(f.confidence * 100)}%)`);
      }
    }
  } catch (error) {
    console.error('Azure extraction error:', error);
  }
}

function getContentType(ext: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

testAzureExtraction().catch(console.error);

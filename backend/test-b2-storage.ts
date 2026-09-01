import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env file
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('✅ Loaded .env file');
} else {
  console.log('⚠️ No .env file found');
}

import { getStorageConfig } from './src/config/storage.config.js';
import { createS3Client, ensureBucket, createPresignedUploadUrl, createPresignedDownloadUrl, headObject, deleteObject, checkStorageHealth } from './src/services/storage.service.js';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async function testB2Storage() {
  console.log('=== Backblaze B2 Storage Test ===\n');

  // Check config
  const config = getStorageConfig();
  console.log('Storage Config:');
  console.log('  Endpoint:', config.endpoint);
  console.log('  Bucket:', config.bucket);
  console.log('  Region:', config.region);
  console.log('  Provider:', config.provider);
  console.log('  Access Key:', config.accessKey ? config.accessKey.slice(0, 8) + '...' : 'NOT SET');
  console.log('  Secret Key:', config.secretKey ? '***' + config.secretKey.slice(-4) : 'NOT SET');
  console.log('');

  // Create client
  const s3 = createS3Client();
  console.log('✅ S3 Client created');

  // Test 1: Health Check
  console.log('\n--- Test 1: Health Check ---');
  const isHealthy = await checkStorageHealth();
  console.log('Health:', isHealthy ? '✅ PASS' : '❌ FAIL');

  // Test 2: Ensure Bucket
  console.log('\n--- Test 2: Ensure Bucket ---');
  try {
    await ensureBucket();
    console.log('✅ Bucket ensured');
  } catch (err) {
    console.log('❌ Bucket error:', err instanceof Error ? err.message : String(err));
  }

  // Test 3: Create Presigned Upload URL
  console.log('\n--- Test 3: Presigned Upload URL ---');
  const testKey = `test/test-file-${Date.now()}.txt`;
  let uploadUrl = '';
  try {
    uploadUrl = await createPresignedUploadUrl(
      testKey,
      'text/plain',
      1024,
      300,
    );
    console.log('✅ Upload URL created');
    console.log('   URL length:', uploadUrl.length, 'chars');
  } catch (err) {
    console.log('❌ Upload URL error:', err instanceof Error ? err.message : String(err));
  }

  // Test 4: Upload a test file
  console.log('\n--- Test 4: Upload Test File ---');
  if (uploadUrl) {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: 'Hello from B2 test!',
        headers: { 'Content-Type': 'text/plain' },
      });
      console.log('✅ Upload status:', response.status);
    } catch (err) {
      console.log('❌ Upload error:', err instanceof Error ? err.message : String(err));
    }
  }

  // Test 5: Head Object
  console.log('\n--- Test 5: Head Object ---');
  try {
    const meta = await headObject(testKey);
    console.log('✅ File metadata:');
    console.log('   Size:', meta.size, 'bytes');
    console.log('   Checksum:', meta.checksum);
  } catch (err) {
    console.log('❌ Head error:', err instanceof Error ? err.message : String(err));
  }

  // Test 6: Create Presigned Download URL
  console.log('\n--- Test 6: Presigned Download URL ---');
  try {
    const downloadUrl = await createPresignedDownloadUrl(testKey, 300);
    console.log('✅ Download URL created');
    console.log('   URL length:', downloadUrl.length, 'chars');
  } catch (err) {
    console.log('❌ Download URL error:', err instanceof Error ? err.message : String(err));
  }

  // Test 7: Cleanup
  console.log('\n--- Test 7: Cleanup ---');
  try {
    await deleteObject(testKey);
    console.log('✅ Test file deleted');
  } catch (err) {
    console.log('❌ Delete error:', err instanceof Error ? err.message : String(err));
  }

  console.log('\n=== Test Complete ===');
}

testB2Storage().catch(console.error);

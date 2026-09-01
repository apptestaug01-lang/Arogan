import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Backblaze B2 configuration
const cfg = {
  endpoint: 'https://s3.us-east-005.backblazeb2.com',
  region: 'us-east-005', forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: { accessKeyId: 'YOUR_B2_KEY_ID', secretAccessKey: 'YOUR_B2_APPLICATION_KEY' },
};
const client = new S3Client(cfg);
const key = `borrowers/test/applications/app-1/documents/KYC/${Date.now()}/x.pdf`;
const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: 'loanflow-documents', Key: key, ContentType: 'application/pdf', ContentLength: 5 }), { expiresIn: 300 });
const put = await fetch(url, { method: 'PUT', body: 'hello', headers: { 'Content-Type': 'application/pdf' } });
console.log('PUT', put.status);
try {
  const head = await client.send(new HeadObjectCommand({ Bucket: 'loanflow-documents', Key: key }));
  console.log('HEAD OK size=', head.ContentLength, 'etag=', head.ETag);
} catch (e) {
  console.log('HEAD FAILED:', e.name, e.$metadata?.httpStatusCode, e.message);
}

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const cfg = {
  endpoint: 'https://loanflow-minio.onrender.com:443',
  region: 'us-east-1', forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
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

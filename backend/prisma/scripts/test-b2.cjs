const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

const config = {
  endpoint: 's3.us-east-005.backblazeb2.com',
  port: 443,
  useSsl: true,
  accessKey: '0055d6f491251810000000002',
  secretKey: 'K0057eKthw+In5RGFlVGy6tNzjaI/pc',
  bucket: 'loanflow-backend',
  region: 'us-east-005',
};

const s3 = new S3Client({
  endpoint: `https://${config.endpoint}:${config.port}`,
  region: config.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.accessKey,
    secretAccessKey: config.secretKey,
  },
});

async function main() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.bucket }));
    console.log(`B2 bucket "${config.bucket}" is accessible`);
  } catch (err) {
    console.error('B2 connection failed:', err.message || err);
    process.exit(1);
  }
}

main();

import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../config/storage.config.js';

async function listAllFiles() {
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

  console.log('Files in bucket:');

  let continuationToken: string | undefined;
  let totalFiles = 0;

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && !obj.Key.endsWith('/')) {
          console.log(`  ${obj.Key}`);
          totalFiles++;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`\nTotal: ${totalFiles} files`);
}

listAllFiles().catch(console.error);

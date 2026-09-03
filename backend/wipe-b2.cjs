// DESTRUCTIVE: Deletes ALL objects in the loanflow-documents B2 bucket.
// Run with:  node wipe-b2.cjs
//
// Run `node wipe-b2.cjs --dry-run` first to see what would be deleted.

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3 = new S3Client({
  endpoint: 'https://s3.us-east-005.backblazeb2.com:443',
  region: process.env.B2_REGION || 'us-east-005',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

const BUCKET = process.env.B2_BUCKET || 'loanflow-documents';
const DRY_RUN = process.argv.includes('--dry-run');

async function listAll() {
  const all = [];
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }),
    );
    for (const obj of r.Contents || []) all.push(obj.Key);
    token = r.NextContinuationToken;
  } while (token);
  return all;
}

async function deleteBatch(keys) {
  if (keys.length === 0) return;
  const res = await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
  return res.Deleted?.length || 0;
}

async function main() {
  console.log(`Bucket: ${BUCKET}`);
  console.log(DRY_RUN ? '--- DRY RUN ---' : '--- WIPING BUCKET ---');

  const all = await listAll();
  console.log(`Found ${all.length} objects total`);

  if (all.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  if (DRY_RUN) {
    for (const k of all.slice(0, 20)) console.log(`  would delete: ${k}`);
    if (all.length > 20) console.log(`  ... and ${all.length - 20} more`);
    return;
  }

  // Delete in batches of 1000 (S3 limit)
  let total = 0;
  for (let i = 0; i < all.length; i += 1000) {
    const batch = all.slice(i, i + 1000);
    const deleted = await deleteBatch(batch);
    total += deleted || batch.length;
    console.log(`  deleted batch ${Math.floor(i / 1000) + 1}: ${total}/${all.length}`);
  }

  console.log(`--- WIPED ${total} OBJECTS ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

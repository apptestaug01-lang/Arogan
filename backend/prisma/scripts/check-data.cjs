const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.$queryRawUnsafe(`
    SELECT "id", "applicationId", "userId", "originalName"
    FROM "Document"
    WHERE "applicationId" IS NOT NULL
    LIMIT 10
  `);
  console.log('Documents with non-null applicationId:');
  for (const doc of docs) {
    console.log(`  ${doc.id}: applicationId=${doc.applicationId}, userId=${doc.userId}, name=${doc.originalName}`);
  }

  const apps = await prisma.$queryRawUnsafe(`
    SELECT "applicationId", "userId"
    FROM "Application"
    LIMIT 10
  `);
  console.log('\nExisting applications:');
  for (const app of apps) {
    console.log(`  ${app.applicationId}: userId=${app.userId}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Query failed:', err);
  process.exit(1);
});

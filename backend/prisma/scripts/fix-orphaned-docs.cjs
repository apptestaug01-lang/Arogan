const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    UPDATE "Document"
    SET "applicationId" = NULL
    WHERE "applicationId" IS NOT NULL
      AND "applicationId" NOT IN (SELECT "applicationId" FROM "Application")
  `);
  console.log('Fixed orphaned documents:', result.count ?? 'ok');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});

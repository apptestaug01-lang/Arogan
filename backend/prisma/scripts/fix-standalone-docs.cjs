const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    UPDATE "Document"
    SET "applicationId" = NULL
    WHERE "applicationId" = 'standalone'
  `);
  console.log('Migrated standalone applicationId to null:', result.count ?? 'ok');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

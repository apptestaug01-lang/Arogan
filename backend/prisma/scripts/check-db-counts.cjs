const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = ['User', 'Application', 'Document', 'DocumentArchive', 'DocumentExtraction', 'Session', 'AuditLog', 'OTPRequest'];
  
  for (const table of tables) {
    const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${table}"`);
    const count = result[0]?.count ?? 'unknown';
    console.log(`${table}: ${count} rows`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});

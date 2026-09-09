const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('Existing tables:', tables.map((t) => t.table_name).join(', '));

  const deleteOrder = [
    'DocumentArchive',
    'DocumentExtraction',
    'Document',
    'Application',
    'Session',
    'AuditLog',
    'OTPRequest',
    'User',
  ];

  for (const table of deleteOrder) {
    const exists = await prisma.$queryRawUnsafe(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}') AS exists`);
    if (exists[0].exists) {
      const result = await prisma.$queryRawUnsafe(`DELETE FROM "${table}"`);
      console.log(`Deleted from ${table}:`, result.count ?? 'ok');
    } else {
      console.log(`Skipped ${table} (does not exist)`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});

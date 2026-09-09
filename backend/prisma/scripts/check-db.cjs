const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'Document'
    ORDER BY ordinal_position
  `);
  console.log('Document table columns:');
  for (const col of columns) {
    console.log(`  ${col.column_name}: ${col.data_type} nullable=${col.is_nullable}`);
  }

  const fks = await prisma.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'Document'::regclass AND contype = 'f'
  `);
  console.log('\nDocument foreign keys:');
  for (const fk of fks) {
    console.log(`  ${fk.conname}: ${fk.definition}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Query failed:', err);
  process.exit(1);
});

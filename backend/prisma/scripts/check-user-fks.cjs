const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fks = await prisma.$queryRawUnsafe(`
    SELECT
      tc.table_name AS from_table,
      kcu.column_name AS from_column,
      ccu.table_name AS to_table,
      ccu.column_name AS to_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'User'
    ORDER BY tc.table_name
  `);
  console.log('Foreign keys referencing User:');
  for (const fk of fks) {
    console.log(`  ${fk.from_table}.${fk.from_column} -> ${fk.to_table}.${fk.to_column}`);
  }

  const users = await prisma.$queryRawUnsafe(`
    SELECT "id", "email", "fullName"
    FROM "User"
    LIMIT 5
  `);
  console.log('\nSample users:');
  for (const u of users) {
    console.log(`  ${u.id}: ${u.fullName} (${u.email})`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Query failed:', err);
  process.exit(1);
});

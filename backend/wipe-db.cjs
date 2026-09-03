// DESTRUCTIVE: Wipes ALL data from the production Render Postgres database.
// Run with:  node wipe-db.cjs
//
// Tables deleted (in FK-safe order):
//   DocumentExtraction -> Document -> Application -> Session -> OtpRequest
//   -> AuditLog -> RefreshToken (if exists) -> User
//
// Run `node wipe-db.cjs --dry-run` first to see counts without deleting.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '--- DRY RUN (no deletes) ---' : '--- WIPING DATABASE ---');

  const models = [
    'documentExtraction',
    'document',
    'application',
    'session',
    'otpRequest',
    'auditLog',
    'refreshToken',
    'user',
  ];

  for (const m of models) {
    if (!prisma[m]) {
      console.log(`  skip ${m} (model not in schema)`);
      continue;
    }
    try {
      const count = await prisma[m].count();
      if (DRY_RUN) {
        console.log(`  would delete ${count} ${m}`);
      } else {
        const res = await prisma[m].deleteMany({});
        console.log(`  deleted ${res.count} ${m}`);
      }
    } catch (e) {
      console.log(`  error on ${m}: ${e.message}`);
    }
  }

  console.log(DRY_RUN ? '--- DRY RUN COMPLETE ---' : '--- DATABASE WIPED ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

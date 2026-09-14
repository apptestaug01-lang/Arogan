import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envFile = resolve(root, '.env.render');

function loadEnv(path) {
  const raw = readFileSync(path, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim();
    const unquoted = value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1)
      : value;
    env[match[1]] = unquoted;
  }
  return env;
}

const env = loadEnv(envFile);
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL not found in', envFile);
  process.exit(1);
}

process.env.DATABASE_URL = env.DATABASE_URL;

const prisma = new PrismaClient();

const tablesInOrder = [
  'DocumentExtraction',
  'DocumentArchive',
  'Session',
  'AuditLog',
  'Document',
  'Application',
  'OTPRequest',
  'User',
];

async function main() {
  for (const table of tablesInOrder) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    console.log(`Deleted all rows from ${table}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

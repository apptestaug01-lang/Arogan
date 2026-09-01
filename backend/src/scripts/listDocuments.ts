import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({
    where: { status: { not: 'DELETED' } },
    select: { id: true, originalName: true, userId: true },
  });

  console.log('Documents in database:');
  for (const doc of docs) {
    console.log(`  ${doc.id} - ${doc.originalName} (userId: ${doc.userId})`);
  }

  await prisma.$disconnect();
}

main();

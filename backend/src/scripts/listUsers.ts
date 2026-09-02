import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  console.log('Users in database:');
  for (const user of users) {
    console.log(`  ${user.id} - ${user.email}`);
  }

  const applications = await prisma.application.findMany({
    select: { id: true, userId: true },
  });

  console.log('\nApplications in database:');
  for (const app of applications) {
    console.log(`  ${app.id} - userId: ${app.userId}`);
  }

  await prisma.$disconnect();
}

main();

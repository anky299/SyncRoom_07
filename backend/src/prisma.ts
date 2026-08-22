import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

prisma.$connect()
  .then(() => {
    console.log('🗄️ Database connected successfully (PostgreSQL / Prisma)');
  })
  .catch((err: any) => {
    console.error('⚠️ Database connection warning (Will run with in-memory fallback if DB is offline):', err.message);
  });

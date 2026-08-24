import http from 'http';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import logger from './middleware/logger.js';
import { stopCleanupJob } from './services/cleanup.service.js';

const port = process.env.PORT || 4000;

const server = http.createServer(app);

async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (err) {
    logger.error({ err: { message: err instanceof Error ? err.message : String(err) } }, 'Database connection error');
    process.exit(1);
  }
}

await connectDB();

server.listen(port, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    stopCleanupJob();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Force shutdown after 30s');
    process.exit(1);
  }, 30_000);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: { message: reason instanceof Error ? reason.message : String(reason) } }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err: Error) => {
  logger.error({ err: { message: err.message, stack: err.stack } }, 'Uncaught exception');
  process.exit(1);
});

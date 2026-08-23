import http from 'http';
import app from './app.js';
import { prisma } from './lib/prisma.js';

const port = process.env.PORT || 4000;

const server = http.createServer(app);

async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

await connectDB();

server.listen(port, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

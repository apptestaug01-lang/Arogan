import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { storageRouter } from './routes/storage.routes.js';
import { documentsRouter } from './routes/documents.routes.js';
import { applicationsRouter } from './routes/applications.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { validateEnv } from './utils/env.validation.js';
import { startCleanupJob, stopCleanupJob } from './services/cleanup.service.js';
import logger, { logRequest } from './middleware/logger.js';

const env = validateEnv();

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.url, res.statusCode, duration, req.ip, req.get('user-agent'));
  });
  next();
});

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX * 10,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

app.get('/health', async (_req, res) => {
  const dbOk = await checkDatabaseHealth();
  res.status(dbOk ? 200 : 503).json({
    success: dbOk,
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'connected' : 'disconnected',
    },
  });
});

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err: { message: err instanceof Error ? err.message : String(err) } }, 'Database health check failed');
    return false;
  }
}

app.use('/api/auth', authRouter);
app.use('/api/storage', storageRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/applications', applicationsRouter);

app.use(notFound);
app.use(errorHandler);

if (env.NODE_ENV === 'production') {
  startCleanupJob();
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopCleanupJob();
});

export default app;

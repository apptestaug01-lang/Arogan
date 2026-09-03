FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl git python3 make g++

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npm run db:generate
RUN npm run build

FROM node:20-alpine AS runner

# poppler-utils: pdftoppm (PDF -> PNG rasterization) for OCR of scanned PDFs
# tesseract-ocr:  OCR engine for extracting text from rasterized images
# Without these, scanned PDFs (no embedded text) cannot be processed and the
# vision LLM is also bypassed because the @cf/meta/llama-3.x models are text-only.
RUN apk add --no-cache libc6-compat openssl git poppler-utils tesseract-ocr

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Sync the Prisma schema to the database on every start so newly added models
# (e.g. Document) exist in production. Render injects DATABASE_URL at runtime,
# which is why this runs here rather than at build time. `db push` is additive
# and non-destructive for existing tables.
CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate && node dist/server.js"]

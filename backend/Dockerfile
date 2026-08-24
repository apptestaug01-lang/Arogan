FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npm run build
RUN npm run db:generate

FROM node:20-alpine AS runner

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

RUN npx prisma generate

CMD ["node", "dist/server.js"]

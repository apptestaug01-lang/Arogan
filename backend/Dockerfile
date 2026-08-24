FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl git python3 make g++

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npm run db:generate
RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl git

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

CMD ["node", "dist/server.js"]

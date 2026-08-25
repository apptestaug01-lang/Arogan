FROM node:20-alpine AS builder

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund --omit=dev
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

CMD ["sh", "-c", "serve -s -l $PORT dist"]

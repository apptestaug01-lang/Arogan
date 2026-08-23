# Development Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm

## Setup

### 1. Clone and Install Dependencies

```bash
git clone <repo-url>
cd BusinessLoanApp

# Backend
cd backend
npm install

# Frontend (new terminal)
cd ../frontend
npm install
```

### 2. Configure Environment Variables

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env if needed

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env if needed
```

### 3. Start Database

```bash
docker compose up -d postgres
```

### 4. Generate Prisma Client

```bash
cd backend
npx prisma generate
npx prisma db push
```

### 5. Run Development Servers

```bash
# Backend (terminal 1)
cd backend
npm run dev

# Frontend (terminal 2)
cd frontend
npm run dev
```

## Available Scripts

### Backend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with ts-node |
| `npm run build` | Build TypeScript |
| `npm start` | Start production server |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma db push` | Push schema to database |
| `npx prisma studio` | Open Prisma Studio |
| `npm run lint` | Run ESLint and fix issues |
| `npm run typecheck` | Run TypeScript type checker |
| `npm test` | Run tests |

### Frontend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checker |
| `npm test` | Run tests |

## Docker

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild services
docker compose up --build -d
```

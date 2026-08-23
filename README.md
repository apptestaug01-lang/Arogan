# BusinessLoanApp

Open-source business loan application platform built with Node.js, Express, TypeScript, React, Prisma, and PostgreSQL. Uses shadcn/ui for a production-ready UX component library.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, JWT
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui (Radix UI)
- **DevOps**: Docker, Docker Compose
- **Auth**: JWT (HS256) with access/refresh token rotation, OTP login

## Project Structure

```
BusinessLoanApp/
├── backend/               # Express API server (TypeScript)
│   ├── prisma/
│   │   └── schema.prisma   # Prisma data model (User, Session, OTPRequest, AuditLog)
│   ├── src/
│   │   ├── middleware/    # Auth, validation, errors, rate limiting, logging
│   │   ├── routes/        # API routes (auth.ts)
│   │   ├── services/      # Business logic (auth, otp, token, audit)
│   │   ├── utils/         # Crypto helpers, validation schemas, constants
│   │   ├── app.ts         # Express app with middleware
│   │   └── server.ts      # HTTP server entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/              # React + Vite app (TypeScript)
│   ├── src/
│   │   ├── components/    # Custom UX (PasswordStrength, OtpInput)
│   │   │   └── ui/        # shadcn/ui components (Button, Input, Card, etc.)
│   │   ├── pages/         # Route pages (Login, OtpVerify, Dashboard)
│   │   ├── services/      # API client, auth service, auth context
│   │   ├── lib/           # Utility functions (cn helper)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── components.json    # shadcn/ui configuration
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── docs/                  # API docs and development guide
├── docker-compose.yml     # PostgreSQL + Backend + Frontend
└── .gitignore
```

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd BusinessLoanApp

# Backend
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma db push

# Frontend (new terminal)
cd ../frontend
npm install
cp .env.example .env

# Start database
docker compose up -d postgres

# Run backend
cd backend
npm run dev

# Run frontend
cd ../frontend
npm run dev
```

## Docker

```bash
# Full stack
docker compose up --build -d

# Stop
docker compose down
```

## License

MIT

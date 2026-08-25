# 🚀 LoanFlow Deployment Guide — Render

## Overview
This guide walks through deploying the **BusinessLoanApp** (backend + frontend + PostgreSQL) to [Render](https://dashboard.render.com).

## Prerequisites

| Item | Status |
|------|--------|
| Render account | ✅ [Sign up at render.com](https://dashboard.render.com) |
| GitHub repo connected | ✅ Push code to GitHub, link repo to Render |
| PostgreSQL database | ✅ `arogandb` exists in Oregon region |
| Brevo SMTP credentials | ⚠️ Get from [brevo.com](https://www.brevo.com) |
| JWT secrets | ⚠️ Generate with `openssl rand -base64 32` |

---

## Step 1: Generate Secrets

```bash
# Generate secure JWT secrets
openssl rand -base64 32  # → JWT_ACCESS_SECRET
openssl rand -base64 32  # → JWT_REFRESH_SECRET
```

### Set in Render Dashboard → Secrets:
```
JWT_ACCESS_SECRET = <paste-generated-secret>
JWT_REFRESH_SECRET = <paste-generated-secret>
BREVO_API_KEY = <your-brevo-api-key>
BREVO_FROM_EMAIL = no-reply@yourdomain.com
```

> **Note**: Never put real secrets in `.env` files committed to Git. Always use Render's Secrets Manager.

---

## Step 2: Deploy Backend

1. Go to [Render Dashboard](https://dashboard.render.com/new/web-service)
2. Select your GitHub repo
3. Configure:
   - **Name**: `loanflow-backend`
   - **Region**: Oregon
   - **Branch**: `main`
   - **Runtime**: `Docker`
   - **Dockerfile**: `backend/Dockerfile`
   - **Plan**: Free or Starter ($7)

4. Add environment variables (from `.env.production`):
   ```
   NODE_ENV=production
   DATABASE_URL=postgresql://arogandb_user:j9rooEMRQug0rCID5dc8Ae6VgbiNdyvp@dpg-da62hl0jo6nc73e5knag-a.oregon-postgres.render.com/arogandb
   JWT_ACCESS_SECRET=<from-secrets>
   JWT_REFRESH_SECRET=<from-secrets>
   CORS_ORIGIN=https://loanflow-frontend.onrender.com
   FRONTEND_URL=https://loanflow-frontend.onrender.com
   BREVO_FROM_EMAIL=no-reply@loanflow.app
   BREVO_FROM_NAME=LoanFlow
   BREVO_REPLY_TO=support@loanflow.app
   SESSION_CLEANUP_INTERVAL_MS=3600000
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=5
   BCRYPT_COST=12
   OTP_EXPIRY_SECONDS=60
   OTP_MAX_REQUESTS_PER_WINDOW=5
   OTP_WINDOW_MINUTES=10
   MAX_FAILED_ATTEMPTS=5
   LOCKOUT_MINUTES=15
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   ```

5. Click **Create Web Service**

> Render will build the Docker image, run migrations (if configured), and start the server.
> The backend auto-deploys on every push to `main`.

### Verify Backend
- Health check: `https://loanflow-backend.onrender.com/health`
- Should return `{"success":true,"status":"ok","services":{"database":"connected"}}`

---

## Step 3: Push Database Schema

The database `arogandb` is already provisioned. Push the Prisma schema:

```bash
# Local development (schema push):
DATABASE_URL="postgresql://arogandb_user:j9rooEMRQug0rCID5dc8Ae6VgbiNdyvp@dpg-da62hl0jo6nc73e5knag-a.oregon-postgres.render.com/arogandb" npx prisma db push --accept-data-loss

# Or use migration (recommended for production):
DATABASE_URL="postgresql://arogandb_user:j9rooEMRQug0rCID5dc8Ae6VgbiNdyvp@dpg-da62hl0jo6nc73e5knag-a.oregon-postgres.render.com/arogandb" npx prisma migrate deploy
```

---

## Step 4: Deploy Frontend

1. Go to [Render Dashboard](https://dashboard.render.com/new/web-service)
2. Select your GitHub repo
3. Configure:
   - **Name**: `loanflow-frontend`
   - **Region**: Same as backend (Oregon)
   - **Branch**: `main`
   - **Runtime**: `Docker`
   - **Dockerfile**: `frontend/Dockerfile`
   - **Plan**: Free

4. Environment variables:
   ```
   NODE_ENV=production
   VITE_API_URL=https://loanflow-backend.onrender.com/api
   ```

5. Click **Create Web Service**

### Verify Frontend
- Visit `https://loanflow-frontend.onrender.com`
- Signup/login should work and connect to backend

---

## Step 5: Configure CORS (if URLs change)

If Render assigns different domain names, update:

```
# On backend service:
CORS_ORIGIN=https://your-frontend.onrender.com
FRONTEND_URL=https://your-frontend.onrender.com

# On frontend service:
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## Step 6: Brevo Email Setup (Production)

1. **Create Brevo account**: [brevo.com](https://www.brevo.com) (free tier: 9,000 emails/month)
2. **Verify sender domain**: Add SPF/DKIM/DMARC DNS records
3. **Get SMTP credentials**: Settings → SMTP / API → Generate key
4. **Set in Render Secrets**: `BREVO_SMTP_USER`, `BREVO_SMTP_PASS`, `BREVO_FROM_EMAIL`

> In development mode (NODE_ENV ≠ "production"), emails are logged but not sent. This is handled by the provider factory in `email.service.ts`.

---

## Deployment Checklist

- [x] ✅ PostgreSQL database `arogandb` exists on Render
- [x] ✅ `render.yaml` configured
- [x] ✅ Prisma schema deployed to database
- [x] ✅ `.env.production` files created
- [ ] ⚠️ JWT_ACCESS_SECRET set in Render Secrets
- [ ] ⚠️ JWT_REFRESH_SECRET set in Render Secrets
- [ ] ⚠️ Brevo SMTP credentials set in Render Secrets
- [ ] ⚠️ Brevo sender domain verified
- [ ] ⚠️ CORS_ORIGIN matches frontend URL
- [ ] ⚠️ VITE_API_URL matches backend URL

## Monitoring

| What | How |
|------|-----|
| Backend health | Visit `/health` endpoint |
| Logs | `render logs -s loanflow-backend` |
| Database | Render dashboard → arogandb |
| Email delivery | Brevo dashboard |
| Application errors | Check backend logs for stack traces |

## Environment Variables Reference

### Backend (Required)
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | 32+ char random string |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | 32+ char random string |
| `CORS_ORIGIN` | Frontend URL for CORS | `https://app.onrender.com` |
| `FRONTEND_URL` | Frontend URL for email links | `https://app.onrender.com` |

### Backend (Optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `BREVO_SMTP_USER` | — | Brevo SMTP username |
| `BREVO_SMTP_PASS` | — | Brevo SMTP password |
| `BREVO_FROM_EMAIL` | `no-reply@loanflow.app` | Default sender |
| `BREVO_FROM_NAME` | `LoanFlow` | Display name |
| `BREVO_REPLY_TO` | `support@loanflow.app` | Reply-to address |

### Frontend
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |

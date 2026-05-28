# Oripa SaaS Starter (Render + Node/Express + Next + Prisma)

This starter gives you a Shopify-style multi-tenant base:
- `apps/api`: Express API with tenant middleware and transactional draw endpoint
- `apps/web`: Next.js vendor storefront/dashboard shell
- `apps/worker`: BullMQ worker for async jobs
- `prisma`: Postgres schema for tenants, packs, draws, wallet ledger

## Quick Start

1. Copy env:
   - `copy .env.example .env`
   - Set `DATABASE_URL` to your Render Postgres **external** URL and append `?sslmode=require`
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run db:generate`
4. Sync schema to database:
   - `npx prisma db push --schema prisma/schema.prisma`
5. Seed demo data:
   - `npm run db:seed`
6. Start all apps:
   - `npm run dev`
7. Open Prisma Studio to view/edit data:
   - `npm run db:studio`

## Run Frontend And Backend Separately (VS Code)

Run from repo root: `C:\Users\Terence\Desktop\braumvault\oripa_saas`

1. Setup (first run):
   - `npm install`
   - `npx prisma db push`
   - `npx prisma generate`
2. Start backend API (Terminal 1):
   - `npm run dev -w @oripa/api`
3. Start frontend web app (Terminal 2):
   - `npm run dev -w @oripa/web -- -p 5555`

Command meaning:
- `npm run dev -w @oripa/web -- -p 5555` = **frontend** (Next.js)
- `npm run dev -w @oripa/api` = **backend** (Express API)

If Turbopack errors on your machine, use:
- `npm run dev -w @oripa/web -- --webpack -p 5555`

## URLs
- Web: `http://localhost:5555`
- API: `http://localhost:4000`
- Prisma Studio: `http://localhost:5555` (only when `npm run db:studio` is running)

## Notes
- Tenant is resolved from `x-tenant-host` header or request host.
- Draws require `x-idempotency-key` to avoid accidental duplicate charges.
- Heavy work should be moved to worker jobs, not handled inside API requests.

## Render Deployment Guide (Monorepo)

This repo deploys as two Render Web Services from the same GitHub repo:
- `oripa-api` (Express API)
- `oripa-web` (Next.js frontend)

### 1. Connect GitHub Repo

1. Push this repository to GitHub.
2. In Render, create services from that same repo.
3. If the repo is not visible in Render:
   - reconnect GitHub in Render Account settings
   - confirm Render app is installed for your org/repo

### 2. Root Directory

Set service **Root Directory** to `.` (repo root).

If you set root to `oripa_saas` but that folder is not inside the selected repo root, deploy will fail with:
- `Root directory 'oripa_saas' does not exist`

### 3. Create API Service First (`oripa-api`)

Service type: Web Service

Build Command:
`npm ci --include=dev && npx prisma generate && npx prisma db push && npm run build -w @oripa/shared && npm run build -w @oripa/api`

Start Command:
`npm run start -w @oripa/api`

Health Check Path:
`/health`

API environment variables (`Add from .env`):

```env
NODE_ENV=production
NPM_CONFIG_PRODUCTION=false
APP_URL=https://REPLACE_WITH_API_RENDER_DOMAIN
WEB_URL=https://REPLACE_WITH_WEB_RENDER_DOMAIN
DATABASE_URL=postgresql://REPLACE_WITH_RENDER_POSTGRES_URL?sslmode=require
JWT_SECRET=REPLACE_WITH_STRONG_RANDOM_SECRET
GOOGLE_CLIENT_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=REPLACE_WITH_GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://REPLACE_WITH_API_RENDER_DOMAIN/v1/auth/google/callback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=REPLACE_WITH_SMTP_USER
SMTP_PASS=REPLACE_WITH_SMTP_PASS
SMTP_FROM=REPLACE_WITH_SMTP_FROM
NEXT_PUBLIC_TENANT_HOST=demo.localhost
DISABLE_DRAW_QUEUE=true
```

### 4. Create Web Service Second (`oripa-web`)

Service type: Web Service

Build Command:
`npm ci --include=dev && npm run build -w @oripa/web`

Start Command:
`npm run start -w @oripa/web`

Web environment variables (`Add from .env`):

```env
NODE_ENV=production
NPM_CONFIG_PRODUCTION=false
NEXT_PUBLIC_API_URL=https://REPLACE_WITH_API_RENDER_DOMAIN
NEXT_PUBLIC_TENANT_HOST=demo.localhost
```

### 5. Google OAuth Setup

In Google Cloud Console for your OAuth Client:

Authorized JavaScript origins:
- `https://REPLACE_WITH_WEB_RENDER_DOMAIN`
- `http://localhost:5555` (optional local)

Authorized redirect URIs:
- `https://REPLACE_WITH_API_RENDER_DOMAIN/v1/auth/google/callback`
- `http://localhost:4000/v1/auth/google/callback` (optional local)

Important:
- Redirect URI must be the **API domain**, not web domain.
- `GOOGLE_CALLBACK_URL` in Render API env must match exactly.
- `WEB_URL` in API env must be your actual web service URL.

### 6. Redeploy Order

When changing URLs or OAuth env:
1. Redeploy `oripa-api`
2. Redeploy `oripa-web`

Use “Clear build cache & deploy” if type/dependency errors persist.

### 7. Common Errors And Fixes

- `Cannot find name 'process'` / `Could not find declaration file for module 'express'`:
  - ensure `npm ci --include=dev` is used in build command
  - ensure `NPM_CONFIG_PRODUCTION=false` is set

- `Next.js build worker exited with code 1` asking for `@types/node`:
  - same fix: include dev deps in build

- Google login returns `not found` after callback:
  - usually `WEB_URL` points to wrong domain
  - verify direct page: `https://<web-domain>/login`

- `redirect_uri_mismatch`:
  - mismatch between Google redirect URI and `GOOGLE_CALLBACK_URL`

### 8. Security Checklist

- Never store secrets in `NEXT_PUBLIC_*` vars.
- Rotate leaked secrets immediately:
  - DB password / `DATABASE_URL`
  - Google client secret
  - SMTP app password
  - JWT secret

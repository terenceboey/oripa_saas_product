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

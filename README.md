# Oripa SaaS Starter (Render + Node/Express + Next + Prisma)

This starter gives you a Shopify-style multi-tenant base:
- `apps/api`: Express API with tenant middleware and transactional draw endpoint
- `apps/web`: Next.js vendor storefront/dashboard shell
- `apps/worker`: BullMQ worker for async jobs
- `prisma`: Postgres schema for tenants, packs, draws, wallet ledger

## Quick Start

1. Copy env:
   - `copy .env.example .env`
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run db:generate`
4. Run migrations:
   - `npm run db:migrate`
5. Seed demo data:
   - `npm run db:seed`
6. Start all apps:
   - `npm run dev`

## URLs
- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Notes
- Tenant is resolved from `x-tenant-host` header or request host.
- Draws require `x-idempotency-key` to avoid accidental duplicate charges.
- Heavy work should be moved to worker jobs, not handled inside API requests.

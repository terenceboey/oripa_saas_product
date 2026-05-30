# Oripa SaaS Project Workflow

**Created:** 2026-05-29T02:28:51Z
**Owner:** Yeqiuqiu / Oripa SaaS
**Target repo:** `/home/yeqiuqiu/oripa_saas`
**Canonical CAR + Stories source:** `docs/oripa-saas-reconciled-car-customer-stories-proposal.md`
**Workflow companion:** `docs/current-oripa-workflow.md`

## Current posture

This project now uses the reconciled CAR + Customer Stories document as the canonical product/engineering workflow input.

Earlier source-family documents under `docs/legacy references/` are provenance only. They should not be used as parallel ticketing sources unless a ticket explicitly needs source verification.

## Objective

Build Oripa SaaS as a safe, tenant-scoped, points-led mystery-pack platform where wallet, draw, catalog/prize metadata, prize entitlement, proof/snapshot, support, and fulfillment surfaces are implemented only when their CARs and stories are satisfied.

## Non-goals

- No payment checkout / Stripe / crypto / deposits unless a separate funding decision replaces seeded/manual pilot credits.
- No cashout, withdrawal, fixed point-dollar equivalence, or bonus-value copy.
- No public provably-fair claim unless verifier inputs, test vectors, seed lifecycle, and customer proof UX exist.
- No shipping/delivery/redemption promise unless fulfillment foundation is implemented.
- No marketplace, trading, web3, voucher, promo/free value, public activity, EV/value-band, or demo-value claims until their gated stories are explicitly picked up.

## Allowed write roots

- Repo code and docs under `/home/yeqiuqiu/oripa_saas`
- Database migrations/scripts only after explicit live-DB approval when they affect Render/live data

## Gate 1 — DEFINE

Current canonical source is defined:

- CARs: `CAR-01` through `CAR-18` in `docs/oripa-saas-reconciled-car-customer-stories-proposal.md`
- Customer/operator stories: `STORY-01` through `STORY-23`
- Launch blocker priority: `P0 — launch-safety blockers`
- Decision gate: `Decision Gate 0 — pre-ticket launch assumptions and decision tickets`

Before any implementation ticket starts, it must declare:

- CAR ID(s)
- Story ID(s)
- Priority: P0/P1/P2/P3
- Concrete acceptance criteria copied/adapted from the canonical doc
- Verification command(s) or inspection evidence
- Copy/claim gates affected

## Gate 2 — DESIGN

Default launch decisions until overridden by explicit decision tickets:

- Funding path: seeded/manual pilot credit only.
- Product mode MVP: `one_prize_pack`; collapse `single_pull` unless justified.
- Proof tier: internal audit/snapshot only; no public provably-fair claim.
- Return-to-points: hidden unless explicitly advertised and implemented.
- Odds disclosure: hide exact odds/ticket tables unless transaction-pool snapshot validation exists.
- Policy storage: must be versioned policy records or immutable draw-time policy snapshots before launch claims depend on it.
- Fulfillment: if physical prize promise is visible, admin-assisted fulfillment foundation becomes P0; otherwise hide fulfillment/shipping copy.

## Gate 3 — BUILD

Implementation order follows the canonical handoff:

1. Decision Gate 0 tickets.
2. Wallet JWT user scoping and tenant boundaries.
3. Product modes and state machines.
4. Immutable wallet ledger for seeded/manual pilot credits.
5. Centralized availability/eligibility/supported-action reason codes.
6. Copy/capability gates and policy version capture.
7. Physical item eligibility/allocation/discrepancy controls.
8. Idempotent transactional paid draw with snapshot/proof and userPrize creation.
9. Product detail disclosure.
10. Draw history/audit/snapshot UX and support trace.
11. Public API hygiene tests/customer-safe errors.
12. Customer inventory/history surfaces.
13. Return-to-points only after inventory + ledger + idempotency + value policy are stable.
14. Discovery/metadata/family/tier surfaces.
15. Fulfillment foundation if physical prize promise is in launch scope.
16. Public activity, EV/value bands, demo/free/promo/voucher/marketplace only after trust foundation is stable.

## Gate 4 — VERIFY

Every completed slice must provide evidence:

- API build: `npm run build -w @oripa/api`
- Web build when UI touched: `npm run build -w @oripa/web`
- Shared package build when types/contracts touched: `npm run build -w @oripa/shared`
- Targeted tests or script output for the slice
- Manual inspection notes for docs-only or migration-only work
- Copy-gate check: no unsupported claims exposed in UI/API strings
- Scope check: no live DB writes/migrations unless explicitly approved

## Gate 5 — SHIP

A slice can ship only when:

- All mapped story acceptance criteria pass or are explicitly deferred.
- Any deferred acceptance criteria are listed in follow-up tickets.
- Public copy matches implemented capability flags.
- Customer-visible claims are allowed by the canonical CAR copy gates.
- Support/audit path exists for customer-money/prize-impacting flows.
- Live migration/deployment steps are written separately and approved before execution.

## Decision log

### D-001 — Adopt reconciled CAR + Customer Stories as workflow source

- **Timestamp:** 2026-05-29T02:28:51Z
- **Phase:** DEFINE
- **Decision:** Use `docs/oripa-saas-reconciled-car-customer-stories-proposal.md` as the canonical CAR/stories source for current Oripa SaaS workflow.
- **Rationale:** It reconciles Clove/current baseline, Phygitals, Collector Crypt, and Packs references into one gated implementation source with copy-safety boundaries.
- **Scope impact:** narrows — prevents parallel ticket generation from older source-family docs.
- **Acceptance impact:** all tickets must map to CAR/story IDs and acceptance criteria.
- **Verification:** inspect this `PROJECTS.md` plus `docs/current-oripa-workflow.md`.

## Active slice note — CatalogItem / TCGTracking

The CatalogItem + TCGTracking work is a catalog/source-data slice, not an inventory ownership slice.

Map it primarily to:

- `CAR-09` — Safe pack disclosure and prize metadata
- `CAR-10` — Category, tag, sort, family, tier, and code discovery
- `STORY-12` — Inspect structured collectible details
- `STORY-16` — Validate product readiness before publish

It must not imply vendor stock, prize ownership, fulfillment, authentication, valuation, or proof unless those later slices are implemented.

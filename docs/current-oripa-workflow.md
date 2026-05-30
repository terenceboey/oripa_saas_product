# Current Oripa SaaS Workflow — CAR + Stories

**Canonical source:** `docs/oripa-saas-reconciled-car-customer-stories-proposal.md`
**Project cockpit:** `PROJECTS.md`
**Status:** canonical for current ticketing/workflow as of 2026-05-29T02:28:51Z

## Rule

Use the reconciled CAR + Customer Stories document as the source of truth for current Oripa SaaS work.

Do not create implementation tickets directly from older source-family docs. Older docs remain evidence/provenance only.

## Ticket template

Every implementation ticket should start with:

```md
## Scope
- CAR: CAR-XX — <title>
- Story: STORY-XX — <title>
- Priority: P0/P1/P2/P3
- Source: docs/oripa-saas-reconciled-car-customer-stories-proposal.md

## Customer / operator value
<one sentence from story/CAR Result>

## Acceptance criteria
- <copied/adapted from canonical story>

## Verification
- API: `npm run build -w @oripa/api`
- Web, if touched: `npm run build -w @oripa/web`
- Shared, if touched: `npm run build -w @oripa/shared`
- Targeted tests/scripts: <exact command>
- Copy-gate check: <unsupported claims hidden?>

## Non-goals
- <explicitly name roadmap/copy/payment/fulfillment/proof exclusions>
```

## P0 ticketing order

Use this order unless a production blocker forces a narrower fix:

1. Decision Gate 0 tickets
   - Funding path
   - Fulfillment scope
   - Proof tier
   - Return-to-points scope
   - Odds disclosure level
   - Policy/version storage
   - `single_pull` versus `one_prize_pack`

2. `CAR-01` / `STORY-01`
   - Authenticated user scope and vendor scope for sensitive reads/writes.

3. `CAR-04` / `STORY-04`
   - Canonical product modes and state model.

4. `CAR-02` / `STORY-02` / `STORY-03` / `STORY-20`
   - Immutable wallet ledger and seeded/manual pilot credit path.

5. `CAR-03` / `STORY-05` / `STORY-21`
   - Central eligibility/availability/supported-action service.

6. `CAR-15` / `STORY-19` / `STORY-22` / `STORY-23`
   - Copy/capability gates, customer-safe public APIs, policy/version capture.

7. `CAR-08` / `STORY-11` / `STORY-16`
   - Physical item eligibility, allocation, discrepancy controls, publish validation.

8. `CAR-05` / `STORY-08`
   - Atomic idempotent paid draw transaction.

9. `CAR-06` / `STORY-09`
   - Draw-time snapshot/proof boundary.

10. `CAR-07` / `STORY-10`
    - Durable userPrize inventory from successful draw.

11. `CAR-13` / `STORY-15`
    - Support trace and operational auditability.

12. `CAR-12` / `STORY-14`, only if physical prize promise is in launch scope
    - Admin-assisted fulfillment foundation.

## P1/P2 lanes after trust foundation

- `CAR-09` / `STORY-06` / `STORY-12`: product detail disclosure and structured collectible metadata.
- `CAR-10`: category, tag, sort, family, tier, code discovery.
- `CAR-11` / `STORY-13`: return-to-points, only if advertised.
- `CAR-14` / `STORY-17`: privacy-safe public proof/social signals.
- `CAR-16`: customer history surfaces.
- `CAR-17` / `STORY-18`: demo/promo/voucher/open-later gates.
- `CAR-18`: future-proofing without roadmap leakage.

## Active CatalogItem / TCGTracking mapping

The current CatalogItem + TCGTracking work is not the whole prize/inventory system.

Use this mapping:

- Primary CAR: `CAR-10 — Category, tag, sort, family, tier, and code discovery`
- Supporting CAR: `CAR-09 — Safe pack disclosure and prize metadata`
- Primary story: `STORY-12 — Inspect structured collectible details`
- Supporting story: `STORY-16 — Validate product readiness before publish`

Acceptance for the CatalogItem / TCGTracking slice:

- TCGTracking products normalize into source-backed `CatalogItem` rows.
- `CatalogItem` remains a global catalog/reference projection, not vendor inventory.
- Vendor stock, prize ownership, fulfillment status, grading cert ownership, cost basis, and pack allocation stay out of `CatalogItem` unless represented as references/metadata only.
- Search supports name/set/card-number/source-backed metadata enough for admin/vendor selection.
- Pilot imports are dry-run by default (`TCGTRACKING_DRY_RUN=true`) and live DB writes require explicit approval plus `TCGTRACKING_DB_ENV` (`local|staging|production`) with production gated by `TCGTRACKING_ALLOW_LIVE_WRITE=true`.
- Importer refuses category ids other than `3` for MVP and refuses `TCGTRACKING_DB_ENV=local` when `DATABASE_URL` points at Render.
- Non-dry-run imports must pass a same-environment source smoke check and must refuse Cloudflare/HTML, non-JSON, empty, or missing-key responses before writes.
- UI/API copy must not imply a catalog item is owned, vaulted, fulfilled, authenticated, insured, priced, or prize-eligible until inventory/publish validation slices support that claim.

## Copy gates to enforce everywhere

Blocked until implemented and approved:

- “Buy points” / checkout / deposits
- `1 point = $1`
- Cashout / withdrawal / sell for cash
- Guaranteed shipping / instant delivery / redemption if fulfillment foundation is missing
- Provably fair / fair odds if public verifier is missing
- Live odds / exact odds if transaction-pool snapshot validation is missing
- Authenticated / vaulted / insured / scanned unless ops evidence exists
- Marketplace / trade / transfer / peer sale
- Crypto / web3 / NFT / Solana / Moonpay / Privy rails

## Definition of done for any slice

A slice is done only when:

- Mapped CAR/story acceptance criteria are satisfied or explicitly deferred.
- Build/test commands relevant to touched packages pass.
- Public copy has been checked against capability flags.
- Cross-user/cross-vendor behavior is covered if the slice touches sensitive records.
- Live DB changes are separated into explicit migration/runbook steps and not applied without approval.

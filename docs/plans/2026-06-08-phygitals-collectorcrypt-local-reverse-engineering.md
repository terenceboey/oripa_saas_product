# Phygitals + Collector Crypt Reverse Engineering: Local Build/Test Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after boss/product approval.

**Goal:** Turn the current Phygitals + Collector Crypt product/reference scan into concrete Oripa SaaS build slices that can be developed and tested locally without copying unsupported claims.

**Architecture:** Keep the current Oripa trust-loop spine: vendor-scoped pack catalog → authenticated customer wallet → idempotent draw → fairness proof/snapshot → custody item → customer history/items → ops custody queue. Reference sites only justify product patterns and data contracts; Oripa code remains the source of truth.

**Tech Stack:** Node/Express API, Next.js app router web, Prisma/Postgres schema, TypeScript workspaces.

---

## Evidence snapshot

Captured fresh public unauthenticated reference artifacts at `docs/reference-artifacts/2026-06-08T14-36-32Z/`.

- `phygitals_available.json`
  - URL: `https://api.phygitals.com/api/vm/available?includeRepacks=true`
  - SHA256: `ae5a003ba3c1cc06e34f46ba8b20c9c28cb7fb1755711d3ff14fbdf6d87afb43`
  - Current observation: 129 pack rows, 52 in stock, price range `$10` to `$10,000`, categories include pokemon/one piece/sports/Yu-Gi-Oh plus null, buyback percentages 85/90/92/100.
- `collectorcrypt_status.json`
  - URL: `https://gacha.collectorcrypt.com/api/status`
  - SHA256: `7ec847a6efeebbc0a9913a516a3a18b8e1b14fb61d48fdcb22e36e8bb9255848`
  - Current observation: machine `running`, 33 gachas, 18 open, 15 closed.
- `collectorcrypt_machines.json`
  - URL: `https://gacha.collectorcrypt.com/api/machines`
  - SHA256: `67ef006b050a80fc7735329b64de131eddc97237a87e4a01760d25b81ed7bea1`
  - Current observation: 33 machines, 15 public, price tiers 25/50/75/80/100/250/1000/2500/5000, instant buybacks 85/90/93, fields include `odds`, `tierRanges`, `stock`, `ev`, `turboMode`, `freeSpins`, `pointsMultiplier`.
- `collectorcrypt_stats_linked_send_nft_spin.json`
  - URL: `https://gacha.collectorcrypt.com/api/stats?data=linkedSendNftAndSpinTxns`
  - SHA256: `5d33775ca6bd80f049fd8836f6131b1fcd573a80fa36adeb355cce6ae8b8303f`
  - Current observation: 100 operational event rows with memo, wallet, spin/send timestamps, tx signatures, NFT address, roll.
- Web docs checked: `https://docs.collectorcrypt.com/gacha/api`, `https://phygitals.com`, `https://gacha.collectorcrypt.com`.
- Local context checked: `README.md`, `PROJECTS.md`, `docs/current-oripa-workflow.md`, `docs/oripa-saas-reconciled-car-customer-stories-proposal.md`, `docs/legacy references/oripa-saas-phygitals-collectorcrypt-final-proposals.md`, Prisma schema and customer/draw/ops/fairness web/API files.

Evidence posture: these are public reference observations only. They do not prove legal compliance, custody safety, vault inventory, marketplace liquidity, shipping operations, or fairness correctness.

## Reverse-engineered primitives

### Phygitals product primitives

- Pack catalog across categories and tiers.
- `mint_price` based paid openings.
- Rarity/value-band distribution rows with lower/upper values and weights.
- EV, min EV, max EV, and EV freshness timestamp.
- Pack variants and family-like grouping.
- In-stock/enable/public availability fields.
- High-conversion trust copy: real graded cards, vault/insurance, VRF, worldwide shipping, marketplace/trade, buyback.
- Live pull velocity fields such as `last_pull` and `num_pulls_7d`.

Oripa translation:

- Safe now: pack status, value bands, reference values, family/tier display, draw proof/snapshot, custody item ownership.
- Only after ops proof: vault/insured/authenticated/shipped/worldwide claims.
- Only after policy/legal + ledger: return-to-points/buyback copy.
- Only after reproducible verifier security review: public “provably fair” copy.

### Collector Crypt product primitives

- Public gacha machine status and per-machine open/closed state.
- Human-readable pack codes (`pokemon_50`, `pokemon_250`, etc.).
- Machine DTO with price, contains count, instant buyback %, free spins, turbo mode, points multiplier, odds, tier ranges, stock by rarity, EV.
- API docs expose partner purchase/open/buyback flow:
  - generate pack transaction with `memo`.
  - open pack by memo.
  - idempotent previous response on already-opened memo.
  - turbo/common auto-buyback branch.
  - buyback eligibility and completion check.
- Operational stats expose chain-of-custody-style event trace: memo → spin tx → send NFT tx → NFT address → roll.

Oripa translation:

- Safe now: public/customer-safe machine status, code/slug, support-visible memo/request id, history/proof surface, custody state machine.
- Near-term: customer item backpack + ops custody request queue already exists behind `CUSTOMER_CUSTODY_ENABLED`.
- Roadmap: turbo/batch opens, free packs, crypto wallet/NFT rails, auto buyback, marketplace.

## Current local repo fit

Strong foundations already present:

- `prisma/schema.prisma`
  - `WalletAccount`, `WalletEntry`, `IdempotencyKey`, `DrawOrder`, `DrawResult`, `DrawFairnessProof`, `DrawFairnessSelection`.
  - `CustodyItem` and `CustodyRequest` already model durable post-draw ownership and redemption/buyback requests.
  - `VendorInventoryItem` and `PackPrizeInventoryAllocation` are enough to start physical-inventory allocation/reconciliation work.
- `apps/api/src/modules/draws/router.ts`
  - Requires `x-idempotency-key`.
  - Runs draw path inside a transaction.
  - Creates draw order, fairness proof, fairness selections, wallet debit entry, draw results, and custody items.
  - Uses HMAC/server-seed/client-seed/nonce inputs for reproducible selections.
- `apps/api/src/modules/customer/router.ts`
  - Customer summary, items, draws, redemption request, buyback request endpoints.
  - Customer custody actions are feature-flagged with `CUSTOMER_CUSTODY_ENABLED`.
- `apps/api/src/modules/ops/router.ts`
  - Staff/manager/owner-scoped custody request queue and status mutation.
- `apps/web/app/fairness-proofs/page.tsx`
  - Customer-facing proof summaries/details and sample verification code.
- `apps/web/app/pack/[packId]/page.tsx`
  - Pack detail + draw UI and link to fairness proofs.

Main gaps versus reference patterns:

1. No explicit central availability/status DTO matching list/detail/draw reason codes.
2. Pack code/family/tier/value-band/EV fields are not first-class enough for Phygitals/Collector-style merchandising.
3. Customer item/backpack UI route is missing even though API/schema exist.
4. Ops custody queue exists API-side, but no clear web ops page for review/approve/complete.
5. Proof page reveals `revealedServerSeed` immediately; okay for post-draw verification, but public copy must avoid “VRF/public provably fair” unless seed lifecycle/test vectors are documented and reviewed.
6. Return/buyback is request-based, not automatic ledger credit. This is safer for MVP, but copy must say “request buyback/return-to-points” not instant cash/buyback.
7. Physical inventory proof is partial: inventory/allocation schema exists, but draw-time eligibility/reservation/double-award guarantees need targeted tests.
8. No test suite files found (`*.test.ts` absent), so initial safety work should add focused unit/integration tests before changing behavior.

## What we should build locally next

Recommended order: build the trust loop surfaces before growth copy.

### Slice A — Customer Backpack / Prize Inventory UI (P0/P1)

Build a `/customer/items` page that calls `GET /v1/customer/items` and shows held prizes, pending requests, redemption/buyback actions, and status history.

Why first:

- Phygitals and Collector Crypt both win by making the post-pull asset durable.
- Oripa already creates `CustodyItem` records after draws; without a UI, the strongest reference lesson is invisible.

Local test path:

- Add serialization unit tests for custody status/action gating.
- Seed a user with a held custody item.
- Run API with `CUSTOMER_CUSTODY_ENABLED=true`.
- Verify browser page shows held item and blocks duplicate request after submitting a request.

### Slice B — Ops Custody Queue UI (P0/P1)

Build `/vendor/working/custody` or `/vendor/custody` to list `GET /v1/ops/custody-requests`, patch statuses, and show linked item/user/draw context.

Why:

- Shipping/buyback claims are unsafe until support/ops can reconcile requests.
- Collector Crypt’s public event trace implies operational back-office linkage; Oripa needs an admin-readable version.

Local test path:

- Add API tests for role gate, vendor scoping, terminal status conflict, and item status transitions.
- Seed pending request.
- Browser verify staff can approve/reject/complete and customer item status updates.

### Slice C — Pack availability/status service (P0)

Create one shared function/DTO for list/detail/draw availability:

```ts
type PackAvailabilityCode =
  | "available"
  | "not_authenticated"
  | "profile_incomplete"
  | "paused"
  | "out_of_stock"
  | "archived"
  | "insufficient_balance"
  | "custody_disabled"
  | "unsupported_region"
  | "emergency_stop";
```

Use it in `GET /v1/packs`, `GET /v1/packs/:id`, and `POST /v1/draws` so customers see the same reason before and during draw.

Why:

- Collector Crypt exposes machine open/closed status; Phygitals exposes `in_stock`/`enable`.
- Oripa needs consistent CTAs and support-safe error codes.

Local test path:

- Unit test status matrix.
- Integration test list/detail/draw consistency for paused/out-of-stock/insufficient balance.

### Slice D — Pack codes, families, tiers, and reference value bands (P1/P2)

Add safe merchandising fields:

- `pack.code` vendor-scoped unique slug/code.
- `pack.familyCode`, `tierLabel`, `riskLabel`.
- `PackValueBand` or JSON snapshot field with label/lower/upper/weight/probability/display order.
- `evPoints`/`evUpdatedAt` only behind freshness/policy gate.

Why:

- Phygitals’ value bands and Collector Crypt’s tierRanges/odds are high-conversion but risky if stale.
- This should be publish-validated, not hand-entered loose copy.

Local test path:

- Prisma migration/generate.
- Publish validation rejects missing/stale value-policy data when value bands are displayed.
- Web pack detail shows bands only when API says safe.

### Slice E — Fairness proof hardening and copy gate (P0/P1)

Keep internal proof surface, but rename customer copy to “draw audit proof” unless full verifier security review is done.

Add:

- Exact verification test vectors in code/docs.
- API test that proof detail is scoped to user+vendor.
- UI copy gate preventing “VRF” or “provably fair” unless capability flag is true.

Why:

- Phygitals markets public VRF; Collector Crypt uses rolls/txs. Oripa has an HMAC proof, but public claim strength must match actual proof tier.

Local test path:

- Deterministic selection unit tests with frozen pool/seed/client seed.
- End-to-end draw creates proof + selections + customer can verify same selected prize.

### Slice F — Physical inventory double-award tests (P0)

Before copying “real cards” copy, add tests around `VendorInventoryItem` and `PackPrizeInventoryAllocation` invariants.

Test invariants:

- inactive/hidden/removed/stale/unallocated inventory cannot enter active draw pool.
- allocated quantity cannot exceed held/available quantity.
- successful draw commits exactly one allocated physical item or fails atomically.
- same physical item cannot be awarded twice under concurrent draws.

Why:

- Randomness proof is not inventory proof.
- This is the biggest gap before “real/vaulted/physical prize” customer claims.

## Explicit non-goals for now

Do not build yet:

- Crypto wallet / NFT / Solana / Privy / Moonpay rails.
- Marketplace, trading, peer transfers, loans.
- Cash buyback/cashout/withdrawal.
- Free packs / referral points / turbo mode / yolo batch opens.
- Worldwide shipping automation.
- Public VRF/provably-fair marketing claim.
- “Vaulted”, “insured”, “authenticated/scanned” copy unless boss supplies operational proof and legal approval.

## Bite-sized implementation plan

### Task 1: Add focused custody unit tests

**Objective:** Lock current status/action behavior before UI work.

**Files:**
- Create: `apps/api/src/lib/customer-custody.test.ts`
- Modify only if needed: `apps/api/package.json`

**Steps:**
1. Add a test runner if none exists, preferably Vitest for TS workspace tests.
2. Test `normalizeCustomerRequestNote`, `nextCustodyItemStatusForRequest`, `canRequestCustodyAction`, and `serializeCustodyItem` pending request behavior.
3. Run: `npm test -w @oripa/api` or the new equivalent.
4. Expected: tests pass and build still passes.

### Task 2: Build customer backpack page

**Objective:** Expose durable post-draw ownership locally.

**Files:**
- Create: `apps/web/app/customer/items/page.tsx`
- Modify: `apps/web/app/pack/[packId]/page.tsx` to link to backpack after draw.
- Modify: CSS only if needed in `apps/web/app/globals.css`.

**Steps:**
1. Render held/pending/redeemed/bought-back/voided statuses.
2. Add buttons for request redemption and request buyback only when `status === HELD` and no pending request.
3. POST to existing customer endpoints with optional note.
4. Refresh item list after action.
5. Run: `npm run build -w @oripa/web`.

### Task 3: Add ops custody queue web page

**Objective:** Let vendor staff reconcile customer custody requests.

**Files:**
- Create: `apps/web/app/vendor/working/custody/page.tsx`
- Modify: vendor dashboard nav if present.

**Steps:**
1. Fetch pending requests.
2. Show item label, customer id/email if API exposes safely, request type/status, notes, timestamps.
3. Patch status to approved/rejected/cancelled/completed.
4. Use explicit terminal-status conflict errors from API.
5. Run: `npm run build -w @oripa/web`.

### Task 4: Create availability service and tests

**Objective:** Centralize pack action state.

**Files:**
- Create: `apps/api/src/modules/packs/availability.ts`
- Test: `apps/api/src/modules/packs/availability.test.ts`
- Modify: `apps/api/src/modules/packs/router.ts`
- Modify: `apps/api/src/modules/draws/router.ts`

**Steps:**
1. Implement pure `evaluatePackAvailability(input)`.
2. Return reason code, customer message, and allowed actions.
3. Replace duplicated route conditions with the service output.
4. Test status matrix.
5. Run API tests and `npm run build -w @oripa/api`.

### Task 5: Add fairness deterministic test vectors

**Objective:** Prove local draw proof can be independently verified.

**Files:**
- Test: `apps/api/src/modules/draws/fairness.test.ts`
- Possibly extract pure helpers from `apps/api/src/modules/draws/router.ts` into `fairness.ts`.

**Steps:**
1. Extract HMAC/float/selection helpers if currently private to router.
2. Use frozen seed/clientSeed/nonce/pool fixtures.
3. Assert selected prize, randomWeightValue, and proof fields.
4. Run API tests and build.

### Task 6: Add public copy capability gate

**Objective:** Prevent unsupported reference-site claims leaking into Oripa UI.

**Files:**
- Create: `apps/shared/src/capability-copy.ts` or API-side copy gate.
- Modify: web pack/fairness/customer pages to use safe labels.

**Steps:**
1. Add blocked terms list from `docs/current-oripa-workflow.md`.
2. Default copy: “draw audit proof”, “request redemption”, “request return-to-points/buyback”.
3. Hide/avoid VRF/vault/insured/authenticated/ship-worldwide/cashback claims.
4. Add snapshot/unit tests if a runner is added.

## Local verification baseline

Current baseline command run on 2026-06-08:

```bash
npm run build
```

Result: PASS.

Important build output:

- `@oripa/shared` TypeScript build passed.
- `@oripa/api` TypeScript build passed.
- `@oripa/web` Next build passed; routes include `/`, `/fairness-proofs`, `/pack/[packId]`, `/vendor`, `/vendor/working/sorting`, auth and setlist pages.
- `@oripa/worker` TypeScript build passed.

## Recommended boss-ready rundown

Bottom line: the best near-term Oripa move is not cloning flashy pack pages; it is finishing the local trust loop that those products imply.

1. Make every paid draw produce a durable item customers can revisit.
2. Let customers request redemption/buyback safely, not instant cash claims.
3. Give ops a queue to approve/reject/complete those requests.
4. Centralize availability so list/detail/draw never disagree.
5. Add value bands/codes/families only behind publish validation.
6. Harden fairness proof and inventory proof before using “provably fair” or “real physical cards” copy.

If the boss asks “what can we demo locally?”: demo catalog → pack detail → draw → fairness proof → backpack item → request buyback/redemption → ops queue status update. That is the smallest defensible Phygitals/CollectorCrypt-inspired vertical slice.

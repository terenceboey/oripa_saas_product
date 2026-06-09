# Oripa Backend Gold-Standard Implementation Plan — Phygitals + Collector Crypt Oracle Audit

Status: Oracle-reviewed backend baseline and implementation queue.

Oracle evidence packet: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_reviews/20260608T144449Z_oripa_backend_phygitals_collectorcrypt_audit/oracle_evidence_packet.md`

- Packet SHA256: `640138ca17282bee8995fbc890251dc5bc89507ab52492245cc846a5212418fd`
- Oracle output: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_reviews/20260608T144449Z_oripa_backend_phygitals_collectorcrypt_audit/oracle_output.md`
- Oracle output SHA256: `2ae39fbda6032bde7f8833570ea83a8bf3b0a788c6281f56629b67e0ab19a556`
- Oracle output bytes: `20892`
- Oracle verification: required headings present; no stub/sandbox response detected.

## Scope

Backend first. Treat Phygitals and Collector Crypt as gold-standard reference products, but Oripa remains its own source of truth.

In scope:

- Auth/vendor/user scoping.
- Wallet reads and wallet ledger.
- Idempotent draw/open transaction.
- Fairness/audit proof.
- Physical inventory allocation and custody proof.
- Customer custody/backpack backend.
- Buyback/redemption request backend.
- Ops review backend.
- Pack availability/status and machine DTOs.
- Value/EV/odds/buyback policy fields.
- Capability/policy gates.
- Backend tests, schema, dependency/security posture.

Out of scope for this backend pass:

- Frontend polish/pages.
- Live Collector Crypt adapter.
- Live Phygitals adapter.
- USDC/payment bridge.
- Automatic shipping labels/provider fulfillment.
- Automatic buyback payout/cashout.
- Marketplace/trading/peer transfer.
- Crypto/NFT/Solana/Privy as Oripa source-of-truth.

## Oracle verdict

`CLEAN_WITH_GAPS` for backend-local MVP / boss demo.

`NOT_CLEAN` for production or Phygitals/CollectorCrypt parity.

Oracle summary: current backend is much stronger than a toy backend because draw atomicity, idempotency, fairness rows, custody items, wallet entries, vendor revenue ledger, audit logs, outbox events, customer APIs, and ops APIs exist. The remaining gaps are backend trust gaps: wallet scoping, availability/status semantics, thin buyback/redemption policy state, no unified root test harness, nullable physical allocation behavior, and incomplete machine/code/status/EV/buyback parity.

## Backend baseline scorecard

- Auth/vendor/user scoping: 3/5
  - Draw/fairness mostly scoped; wallet read is blocker-level leak risk.
- Wallet ledger: 3/5
  - Draw ledger exists; wallet read unsafe; buyback/redemption settlement missing.
- Idempotency: 4/5
  - Draw idempotency strong; needs coverage for buyback/redemption/ops transitions.
- Draw atomicity: 4/5
  - Serializable transaction strong; physical allocation fail-closed still unresolved.
- Fairness/proof: 3/5
  - Good model; needs extracted engine, golden vectors, seed lifecycle review.
- Physical inventory proof: 3/5
  - Allocation helper/tests exist; nullable allocation during draw is the issue.
- Custody/backpack: 3/5
  - Customer/ops APIs exist behind flag; lifecycle/event/ledger effects need strengthening.
- Buyback/redemption: 2/5
  - Request-only; missing quote, eligibility, policy version, expiry, value freshness, ledger settlement.
- Ops support: 3/5
  - Review route exists; financial/inventory side effects and audit trail incomplete.
- Availability/status: 2/5
  - Inline checks; no shared status DTO/reason code service.
- Value/EV/odds: 2/5
  - Missing first-class machine economics fields and freshness guards.
- Policy/capability gates: 2/5
  - Feature flags exist; central product policy gates missing.
- Test coverage: 3/5
  - 20 targeted API scripts passed; root `npm test` missing; negative scope tests incomplete.
- Security/dependency posture: 2/5
  - Build/lint/schema pass; `nodemailer` high advisory; live DB `.env` risk.

## Current verified baseline

Commands run in current audit session:

```bash
npm run build
```

Result: PASS.

```bash
npm run lint
```

Result: PASS.

```bash
npx prisma validate --schema prisma/schema.prisma
```

Result: PASS.

```bash
npm test
```

Result: FAIL — missing root `test` script.

```bash
npm audit --audit-level=moderate
```

Result: FAIL / exit 1 — 2 moderate + 1 high advisories. Backend-relevant high advisory: `nodemailer`.

API targeted scripts: all 20 `apps/api` `test:*` scripts executed and passed, including customer profile/custody, pack inventory/publish/pool integrity, catalog scripts, creative MVP guardrails.

Environment risk: `.env` points at Render Postgres `oripa_sg` with `sslmode=require`; no live DB writes should be performed without approval.

## P0 blockers

### P0-1 — Fix wallet customer scoping leak

Surface: `apps/api/src/modules/wallet/router.ts`

Current risk:

```ts
prisma.walletAccount.findFirst({ where: { vendorId: req.vendorId } })
```

This must become authenticated `vendorId + userId` lookup. This is the first backend task because all Phygitals/CollectorCrypt-grade wallet/open/buyback flows depend on trustworthy account ownership.

Acceptance:

- `GET /v1/wallet` requires authenticated user.
- Query uses `vendorId_userId` or equivalent exact `vendorId + userId` filter.
- Same vendor/two users negative test passes.
- Same user/two vendors negative test passes.
- Unauthenticated request returns 401.
- Missing wallet behavior is deterministic.

Suggested commands:

```bash
npm run lint
npm run build
npm run test:customer:profile -w @oripa/api
npm run test:customer:phase2 -w @oripa/api
```

### P0-2 — Add safe backend test harness and root `npm test`

Surfaces:

- `package.json`
- `apps/api/package.json`
- test setup / environment guard

Current risk:

- Root `npm test` fails.
- `.env` points at hosted Render DB.
- Backend tests must never destructively run against live/prod DB.

Acceptance:

- Root `npm test` runs backend test suite.
- Test setup refuses `DATABASE_URL` containing hosted/live Render DB unless explicitly safe read-only script.
- Test commands run under `NODE_ENV=test` or a controlled test mode.
- No test writes to Render/live DB.

Suggested commands:

```bash
npm test
npm run lint
npm run build
```

### P0-3 — Fail-closed physical inventory allocation for physical packs

Surfaces:

- `apps/api/src/modules/draws/router.ts`
- `apps/api/src/modules/packs/inventory-allocation.ts`
- Prisma schema if custody item should point to allocation row

Current risk:

`commitInventoryAllocationForPrizeDraw` can return `null`. For physical packs, draw should not produce a custody item without allocation proof unless pack mode explicitly says digital/pilot inventory is allowed.

Acceptance:

- Pack/product mode says whether physical allocation is required.
- Physical pack with no held allocation fails before wallet/custody/revenue commit.
- Digital/pilot pack can bypass only by explicit backend mode.
- Custody item references allocation/proof where applicable.
- Rollback test proves failed physical allocation creates no wallet/custody/revenue side effects.

Suggested commands:

```bash
npm run test:packs:inventory-allocation -w @oripa/api
npm run test:draws:pool-integrity -w @oripa/api
npm test
```

## P1 implementation queue

### Card 1 — Central pack availability/status service

Goal: one backend source of truth for whether a pack/machine is visible/openable/sold-out/disabled/not-started/ended/policy-blocked.

Files:

- Create `apps/api/src/modules/packs/availability.ts`
- Modify `apps/api/src/modules/packs/router.ts`
- Modify `apps/api/src/modules/draws/router.ts`
- Add tests/scripts for list/detail/draw consistency.

Contract:

```ts
type PackAvailabilityStatus =
  | "open"
  | "closed"
  | "sold_out"
  | "disabled"
  | "not_started"
  | "ended"
  | "policy_blocked";

type PackAvailabilityReasonCode =
  | "available"
  | "not_authenticated"
  | "profile_incomplete"
  | "insufficient_balance"
  | "paused"
  | "out_of_stock"
  | "not_started"
  | "ended"
  | "policy_missing"
  | "value_stale"
  | "physical_inventory_missing"
  | "emergency_stop";
```

Acceptance:

- Pack list/detail/draw use same evaluator.
- Disabled/sold-out/future/ended/status-blocked packs show the same reason before draw and during draw.
- Draw route no longer owns duplicate business status logic beyond transaction re-check.

### Card 2 — First-class pack code, EV, value-band, and buyback policy fields

Goal: model Phygitals/Collector Crypt machine economics without live provider integration.

Files:

- `prisma/schema.prisma`
- Pack module DTO/mappers
- Pack publish/template logic
- Migration
- Tests around publish immutability and DTO shape.

Backend fields to add/formalize:

- `code` — vendor-scoped stable human-readable code.
- `familyCode`
- `tierLabel`
- `riskBand`
- `valueBandMin`
- `valueBandMax`
- `evPoints` or `evCurrencyAmount`
- `evUpdatedAt`
- `buybackPercent`
- `buybackPolicyVersion`
- `valuePolicyVersion`

Acceptance:

- Code unique per vendor.
- Published economic fields are immutable or versioned.
- Stale EV/value data hides or blocks value-dependent features.
- Public DTO exposes stable code/status/economic fields only where safe.
- No internal source payload leakage.

### Card 3 — Extract fairness engine and add golden vectors

Goal: make draw proof reproducible independent of Express route code.

Files:

- Create `apps/api/src/modules/draws/fairness.ts`
- Modify `apps/api/src/modules/draws/router.ts`
- Add fairness test script.

Acceptance:

- Fixed server seed + client seed + nonce + pool snapshot produces fixed roll/selection.
- Tampered pool hash fails verification.
- Tampered selection fails verification.
- Idempotent replay returns same proof/result.
- Existing proof endpoint remains vendor+user scoped.

### Card 4 — Buyback eligibility and quote backend

Goal: turn buyback from request form into policy-backed backend state machine.

Files:

- `apps/api/src/modules/customer/router.ts`
- `apps/api/src/lib/customer-custody.ts`
- `apps/api/src/modules/ops/router.ts`
- Prisma schema/migration.

Contract fields:

- `custodyItemId`
- `quoteAmount`
- `quoteCurrency` or points unit
- `buybackPercent`
- `policyVersion`
- `valueSource`
- `valueAsOf`
- `expiresAt`
- status: `quoted | requested | approved | rejected | credited | expired | cancelled`
- idempotency key

Acceptance:

- Ineligible item cannot get quote.
- Stale value blocks quote.
- Accept quote is idempotent.
- Ops approval credits wallet once.
- Cross-user quote access denied.
- No automatic payout/payment integration.

### Card 5 — Strengthen redemption/custody ops lifecycle

Goal: ops transitions should perform audited backend transitions, not only status updates.

Files:

- `apps/api/src/modules/customer/router.ts`
- `apps/api/src/modules/ops/router.ts`
- `apps/api/src/lib/customer-custody.ts`
- Prisma schema/migration if needed.

State model:

- `held`
- `redemption_requested`
- `ops_review`
- `approved`
- `packed`
- `fulfilled_manual`
- `rejected`
- `cancelled`

Acceptance:

- Invalid transition rejected.
- Staff role permissions enforced.
- Completion creates audit log.
- Cross-vendor ops access denied.
- Inventory release/lock behavior correct.
- No automatic shipping labels.

### Card 6 — Security/dependency cleanup

Goal: remove or mitigate backend-relevant advisories.

Files:

- Root/package lock
- Email module using `nodemailer`

Acceptance:

- `nodemailer` high advisory resolved by upgrade/removal/mitigation.
- `npm audit --audit-level=moderate` has no backend-relevant high advisory, or documented temporary exception.
- `npm run build`, `npm run lint`, `npm test` pass.

## Do not build yet

- Frontend dashboard polish or new customer/vendor pages in this backend pass.
- Live Collector Crypt adapter.
- Live Phygitals adapter.
- USDC/card/fiat payment rails.
- Cashout/payout automation.
- Automatic buyback payout.
- Automatic shipping label generation.
- Marketplace/listing/trading/peer transfer.
- Crypto/NFT/Solana/Privy source-of-truth.
- Provider custody as source-of-truth.
- Live external pricing feeds as authoritative settlement input.

## First five backend tasks for Hermes/Codex

1. Fix `GET /v1/wallet` scoping and add negative tests.
2. Add root `npm test` and safe DB guard.
3. Create central pack availability/status service.
4. Fail-closed physical inventory allocation for physical packs.
5. Extract fairness logic and add golden proof vectors.

## Gate before claiming backend parity

Do not call backend Phygitals/CollectorCrypt-grade until all are true:

- Root `npm test` passes.
- Build/lint/schema validate pass.
- Wallet/fairness/custody/ops/draw routes have cross-user and cross-vendor negative tests.
- Physical pack draws fail without allocation proof.
- Pack list/detail/draw share status reason codes.
- Buyback has quote/eligibility/policy/version/idempotent settlement backend.
- Ops completion writes audit + ledger/inventory side effects where relevant.
- Dependency audit has no backend high advisory or documented exception.
- No live DB write path is used in tests without explicit approval.

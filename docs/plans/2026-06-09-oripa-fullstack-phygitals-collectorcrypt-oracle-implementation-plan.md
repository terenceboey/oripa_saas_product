# Oripa Fullstack Phygitals / Collector Crypt Parity Plan — Oracle Reviewed

Status: Oracle-reviewed local implementation plan. This is a local repo plan, not a production launch approval.

## Artifact provenance

- Evidence packet: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_reviews/20260609T005621Z_oripa_fullstack_reference_audit/oracle_evidence_packet.md`
- Evidence packet SHA256: `6afd35a19d19bf13c7f33d450481d396af4891293a83426f96041fdf7fd299eb`
- Oracle output: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_reviews/20260609T005621Z_oripa_fullstack_reference_audit/oracle_output.md`
- Oracle output SHA256: `1e39f74f6fee84183c4c75ebd2123bc2c093eef2033b4b2e80457fe8c8e0280f`
- Reference manifest: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_reviews/20260609T005621Z_oripa_fullstack_reference_audit/reference_manifest.json`
- Reference summary: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_reviews/20260609T005621Z_oripa_fullstack_reference_audit/reference_summary.json`
- Baseline command exits: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_reviews/20260609T005621Z_oripa_fullstack_reference_audit/logs/command_exits.txt`

## Safety boundary

- Local repo only.
- Production/live DB touched: false.
- Production migrations applied: false.
- Gateway/services restarted: false.
- Public deploy/push/PR: false.
- Forbidden without explicit approval: hosted DB writes, live migrations, payment/shipping/provider credentials, real Collector Crypt/Phygitals writes, gateway/service restarts, deploy/push/PR.

## Fresh baseline

```text
npm_test_exit=0
npm_lint_exit=0
prisma_validate_exit=0
npm_audit_moderate_exit=1
npm_build_exit=0

```

`npm audit --audit-level=moderate` exits 1 due frontend Next/PostCSS moderate advisory. Oracle explicitly rejected `npm audit fix --force` because it would force an unsafe old Next install path.

---

## Verdict

Oripa is **backend-close but product-incomplete** versus Phygitals and Collector Crypt.

The local repo already has the important safety substrate: backend harness passes, build passes, Prisma validates, custody state machine exists, buyback quote/acceptance exists, ops custody routes exist, fairness proof route exists, pack availability is fail-closed, and physical inventory allocation is being enforced. The remaining gap is not “more gambling logic”; it is **full customer/operator product surface + economics visibility + demo-proof workflows**.

Do **not** jump to live Phygitals/Collector Crypt provider adapters yet. The next winning move is to make local Oripa feel like a real gacha-custody product using internal data only: customer backpack, post-rip decision screen, ops custody queue, pack economics/status display, live activity feed, and browser smoke tests. Evidence packet constraints: local repo only; no production DB writes, no live migrations, no restarts, no deploy/push/PR. 

---

## Current Oripa Capability Scorecard

| Area                     |  Score | Current state                                                                                                                                                          |
| ------------------------ | -----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core pack opening        |   7/10 | Draw route exists with idempotency, wallet debit, availability gate, pool integrity, fairness selection, and inventory commitment.                                     |
| Fairness                 |   7/10 | Fairness engine and `/fairness-proofs` UI exist; needs clearer customer-facing verification copy and proof UX.                                                         |
| Custody backend          |   8/10 | Customer items, draws, redemption request, buyback quote, quote accept, and ops transitions exist.                                                                     |
| Buyback backend          | 6.5/10 | Functional quote policy exists, but current default is 70%, below Collector Crypt-style 85–93% reference positioning. Keep configurable, not hardcoded marketing copy. |
| Customer frontend        |   4/10 | Home, pack detail, login/register, setlists, fairness proofs exist. Missing backpack/items and post-rip action flow.                                                   |
| Ops frontend             |   3/10 | Backend ops routes exist; no full ops custody queue UI.                                                                                                                |
| Pack economics display   |   4/10 | Backend has price/value policy gates; frontend does not yet expose EV/value-band/freshness/buyback/status clearly.                                                     |
| Live/status/social proof |   2/10 | No public machine status or privacy-safe activity feed comparable to reference APIs.                                                                                   |
| Provider readiness       |   3/10 | Custody providers enum includes ORIPA_INTERNAL, COLLECTOR_CRYPT, PHYGITALS, but activation should remain stubbed/local-only.                                           |
| Security posture         |   6/10 | Tests/build/lint pass, but `npm audit` still reports moderate PostCSS/Next advisory with unsafe forced downgrade fix.                                                  |

---

## Missing Product/Backend/Frontend/Ops Capabilities Versus Phygitals and Collector Crypt

Phygitals exposes pack marketplace attributes like enabled/in-stock status, mint price, EV, min/max EV, rarity distribution, last pull, 7-day pulls, buyback percent, category, rewards fields, and variants. Collector Crypt exposes machine status, gacha list, price, EV, stock by tier, odds, tier ranges, instant buyback percentage, turbo mode, free spins, points multiplier, media assets, and transaction/activity-like stats. Oripa should not copy them blindly, but it needs equivalent product confidence surfaces.

The missing Oripa capabilities are:

1. **Customer backpack / prize inventory**

   * Route: `/customer/items`
   * Shows held, redemption requested, buyback requested, redeemed, bought back, voided.
   * Shows prize image, label, estimated value, set/card/rarity, pending request, request history.
   * Calls existing `/v1/customer/items`.

2. **Post-rip decision screen**

   * After draw, show result cards and clear actions:

     * keep in backpack
     * request buyback quote
     * accept quote
     * request redemption
     * view fairness proof
   * Should use existing draw response plus customer custody endpoints.
   * Must fail gracefully if custody feature flag is off.

3. **Ops custody queue UI**

   * Route: `/ops/custody`
   * Uses existing `/v1/ops/custody-requests`.
   * Filters by status.
   * Allows allowed transitions only.
   * Shows buyback quote fields, customer note, ops note, item state, customer identity.

4. **Pack economics/status projection**

   * Add safe fields to pack responses/UI:

     * price
     * remaining/total stock
     * estimated EV
     * min/max value band
     * buyback policy percent
     * value freshness
     * availability reason
     * odds/tier distribution, if available
   * Must avoid “guaranteed profit” wording unless mathematically and legally approved.

5. **Public/customer activity feed**

   * Privacy-safe projection:

     * “Someone pulled X”
     * pack name
     * timestamp
     * value band
     * no full email, no user ID, no address.
   * Useful for Phygitals-like `last_pull` and Collector Crypt-like live activity.

6. **Fairness UX upgrade**

   * Existing page is technical.
   * Add “what this proves / what this does not prove.”
   * Avoid unsupported “VRF” or “provably fair” claims unless the implementation actually uses VRF or public chain commit/reveal.

7. **Wallet ledger/history**

   * Customer-visible balance history:

     * topups
     * draws
     * buyback credits
     * adjustments
   * Required for trust and support.

8. **Demo proof**

   * One local fullstack script or Playwright smoke:

     * login/demo auth setup
     * open pack
     * see result
     * request buyback or redemption
     * ops processes request
     * customer sees updated item state.

---

## Do Not Build Yet

Do **not** build or activate these until local product loop is complete:

1. **Live Collector Crypt / Phygitals provider adapters**

   * Keep provider enum and stub interface only.
   * No real credentials.
   * No provider writes.
   * No external redemption/buyback execution.

2. **Real payment rails**

   * No Stripe, crypto checkout, gateway, top-up provider, or shipping checkout writes yet.
   * Use local/mock ledgers only.

3. **Live migrations**

   * Schema and migration files can be generated in repo.
   * Do not run `prisma migrate deploy`.
   * Do not run migrations against hosted/production DB.

4. **Service restarts / deploy / push / PR**

   * All work remains local repo safe.

5. **Aggressive `npm audit fix --force`**

   * The evidence says forced audit fix would install `next@9.3.3`, a breaking downgrade. Do not run it.
   * Prefer lockfile/Next upgrade strategy in a separate dependency card.

6. **Marketing claims**

   * No “100% return rate,” “risk-free,” “investment,” or “guaranteed EV” language.
   * Use factual labels: estimated EV, buyback quote, value source, value as-of, quote expiry.

---

## Implementation Plan

### Phase 1 — Customer trust loop

Build the customer-facing loop first:

`open pack → reveal prize → choose keep/buyback/redeem → see item in backpack → see fairness proof → see wallet/request history`

This makes Oripa feel like Collector Crypt/Magic Eden Rip Packs without external provider dependency.

Deliverables:

* `/customer/items`
* post-draw result actions inside `/pack/[packId]`
* `/customer/activity` or embedded account history panel
* frontend API client helpers
* smoke tests for customer flow

### Phase 2 — Operator fulfillment loop

Build the ops queue next:

`customer request → ops review → approve/pack/fulfill/credit/reject → customer state updates`

Deliverables:

* `/ops/custody`
* status filter
* transition buttons
* ops note form
* buyback quote display
* local verification script

### Phase 3 — Marketplace confidence surfaces

Add product fields that make packs comparable to Phygitals/Collector Crypt:

* EV estimate
* min/max value band
* odds/tier distribution
* buyback percent
* remaining stock
* last pull
* 7-day pulls
* status/openability reason
* value freshness

Deliverables:

* backend projection service
* route tests
* home/pack UI cards
* fail-closed copy for stale value or missing physical inventory

### Phase 4 — Fairness and activity polish

Make trust understandable:

* better fairness proof copy
* “how to verify” display
* proof links from draw result/history
* privacy-safe live activity feed

Deliverables:

* `/fairness-proofs` copy upgrade
* `/v1/activity/public`
* live feed component
* privacy tests

### Phase 5 — Local boss demo hardening

One repeatable local command should prove the product loop without touching production.

Deliverables:

* seeded local demo fixture or mocked harness
* browser smoke test
* final checklist doc
* no live migration/restart/deploy assumptions

---

## Serial Kanban Cards

### CARD-001 — Customer backpack page

**Goal:** Add `/customer/items` showing the customer’s custody inventory.

**Scope:**

* New Next route: `apps/web/app/customer/items/page.tsx`
* Fetch `GET /v1/customer/items`
* Display item status, prize image, label, value, set/card/rarity, pending request, recent requests.
* Add navigation from home/pack/fairness page where appropriate.

**Acceptance criteria:**

* Customer can see all custody items.
* Empty state is clear.
* Pending request is visible.
* Buyback/redemption actions are disabled when item is not `HELD`.
* Page does not crash when custody feature flag is disabled or endpoint returns 404.

**Verification commands:**

```bash
npm run lint
npm run build
npm run test -w @oripa/api
```

---

### CARD-002 — Post-rip result action panel

**Goal:** After pack draw, show actionable result cards.

**Scope:**

* Update `apps/web/app/pack/[packId]/page.tsx`
* For each drawn prize:

  * show image/label
  * link to fairness proof when draw order exists
  * action: keep in backpack
  * action: request buyback quote
  * action: request redemption
* If custody item ID is not currently returned by draw response, add safe backend projection to include created custody item reference.

**Acceptance criteria:**

* User sees result immediately after draw.
* User can request buyback quote from result screen.
* User can request redemption from result screen.
* Duplicate clicks are guarded.
* Expired/missing quote states are handled.
* Draw still works if custody feature is off, but action panel explains unavailable custody.

**Verification commands:**

```bash
npm run test:customer:phase2 -w @oripa/api
npm run test:draws:fairness-golden-vectors -w @oripa/api
npm run lint
npm run build
```

---

### CARD-003 — Customer buyback quote UX

**Goal:** Make buyback quote/accept flow usable from UI.

**Scope:**

* Quote request button.
* Quote card with amount, currency, buyback percent, value source, value as-of, expiry.
* Accept quote button.
* State refresh after acceptance.
* Display wallet credit result when accepted.

**Acceptance criteria:**

* Quote request creates or reuses active quote idempotently.
* Expired quote cannot be accepted.
* Accepted quote updates item/request status.
* Wallet balance refreshes after credit.
* UI never implies quote is cash unless currency says so.

**Verification commands:**

```bash
npm run test:customer:buyback -w @oripa/api
npm run test:customer:wallet -w @oripa/api
npm run lint
npm run build
```

---

### CARD-004 — Customer redemption request UX

**Goal:** Make physical redemption request visible and trackable.

**Scope:**

* Redemption request form with optional customer note.
* Request status display.
* Disable redemption for buyback requested / bought back / redeemed / voided items.
* Link from backpack and post-rip result.

**Acceptance criteria:**

* Held item can request redemption.
* Duplicate pending redemption is blocked or reused.
* Customer can see request status progression.
* Customer note is normalized and bounded.
* No shipping provider integration is added.

**Verification commands:**

```bash
npm run test:customer:phase2 -w @oripa/api
npm run lint
npm run build
```

---

### CARD-005 — Ops custody queue page

**Goal:** Add operator UI for custody fulfillment.

**Scope:**

* New route: `apps/web/app/ops/custody/page.tsx`
* Fetch `GET /v1/ops/custody-requests?status=...`
* Status filters: `ALL`, `PENDING`, `OPS_REVIEW`, `APPROVED`, `PACKED`, `FULFILLED_MANUAL`, `CREDITED`, `REJECTED`, `CANCELLED`, `COMPLETED`, `EXPIRED`
* Patch status through `PATCH /v1/ops/custody-requests/:id`
* Include ops note.

**Acceptance criteria:**

* OWNER/MANAGER/STAFF can view queue.
* Unauthorized users get safe error.
* Invalid transitions show backend error.
* Buyback approval credits wallet exactly once.
* Terminal requests cannot be changed.

**Verification commands:**

```bash
npm run test:customer:ops-lifecycle -w @oripa/api
npm run lint
npm run build
```

---

### CARD-006 — Pack machine economics projection service

**Goal:** Add local-safe machine/economics projection similar to reference competitors.

**Scope:**

* Backend helper: `buildPackMachineProjection(pack)`
* Fields:

  * `code`
  * `family`
  * `pricePoints`
  * `estimatedEv`
  * `minValue`
  * `maxValue`
  * `buybackPercent`
  * `stock`
  * `odds`
  * `tierRanges`
  * `valueAsOf`
  * `valueFresh`
  * `availability`
* Use internal pack/prize data only.

**Acceptance criteria:**

* Projection is read-only.
* No external provider calls.
* Missing value data returns `valueFresh=false` or policy-blocked status.
* Pack with missing physical inventory is not openable.
* Test covers EV/value band math.

**Verification commands:**

```bash
npm run test:packs:availability -w @oripa/api
npm run test:packs:inventory-allocation -w @oripa/api
npm run test:packs:publish-freeze -w @oripa/api
npm run lint
npm run build
```

---

### CARD-007 — Home and pack economics UI

**Goal:** Expose pack status/value confidence on storefront.

**Scope:**

* Update `apps/web/app/page.tsx`
* Update `apps/web/app/pack/[packId]/page.tsx`
* Display:

  * price
  * remaining stock
  * estimated EV
  * min/max value band
  * buyback policy
  * last pull / 7-day pulls if available
  * availability reason when closed

**Acceptance criteria:**

* UI shows value data only when backend marks it fresh.
* Closed packs show factual reason.
* No “profit” or “guaranteed return” copy.
* Pack detail page makes odds/value bands understandable.

**Verification commands:**

```bash
npm run lint
npm run build
npm run test -w @oripa/api
```

---

### CARD-008 — Privacy-safe activity feed backend

**Goal:** Add public/customer-safe recent activity projection.

**Scope:**

* New route: `GET /v1/activity/public`
* Returns recent completed draws with:

  * pack title
  * prize label or tier label
  * value band
  * timestamp
  * anonymized customer label
* No email, full name, user ID, address, wallet identifier, or internal request ID.

**Acceptance criteria:**

* Feed never leaks PII.
* Feed is vendor-scoped.
* Feed respects hidden/archived pack visibility.
* Test includes PII regression checks.

**Verification commands:**

```bash
npm run test -w @oripa/api
npm run lint
npm run build
```

---

### CARD-009 — Live activity feed frontend

**Goal:** Add social proof without leaking user data.

**Scope:**

* Component on home page and pack detail page.
* Poll or manual refresh only; no websocket required.
* Show “Recent pulls” and “recent buybacks/redemptions” if supported.

**Acceptance criteria:**

* Feed renders empty state.
* Feed refresh is bounded.
* No PII appears.
* UI does not imply fake activity.

**Verification commands:**

```bash
npm run lint
npm run build
```

---

### CARD-010 — Fairness UX copy gate

**Goal:** Make fairness page customer-legible and legally safer.

**Scope:**

* Update `/fairness-proofs`
* Add sections:

  * “What this proves”
  * “What this does not prove”
  * “How to verify”
  * “Why pool snapshot matters”
* Avoid unsupported VRF/blockchain language unless implementation exists.

**Acceptance criteria:**

* Page still shows technical seeds/hash/selection details.
* Copy accurately describes local HMAC/commit-reveal style proof.
* No claim that external blockchain commitment exists unless implemented.
* Draw result links to relevant proof.

**Verification commands:**

```bash
npm run test:draws:fairness-golden-vectors -w @oripa/api
npm run lint
npm run build
```

---

### CARD-011 — Wallet ledger/history page

**Goal:** Give customers transparent balance history.

**Scope:**

* Add `/customer/wallet`
* Fetch wallet entries from existing or new read-only route.
* Display credits/debits, draw costs, buyback credits, timestamps, idempotency/reference label.

**Acceptance criteria:**

* Customer sees current balance and recent entries.
* Entries are vendor/user scoped.
* Buyback credit appears once.
* No admin-only fields exposed.

**Verification commands:**

```bash
npm run test:customer:wallet -w @oripa/api
npm run test:customer:buyback -w @oripa/api
npm run lint
npm run build
```

---

### CARD-012 — Local browser smoke: customer loop

**Goal:** Prove the end-to-end customer journey locally.

**Scope:**

* Add a local smoke script or Playwright-style test if project already supports it.
* Flow:

  * open storefront
  * open pack detail
  * draw pack using mocked/local auth/session
  * see result
  * request buyback quote or redemption
  * visit backpack
  * visit fairness proof

**Acceptance criteria:**

* Runs locally only.
* Does not require production DB.
* Does not require live provider credentials.
* Fails closed if hosted `DATABASE_URL` is detected.

**Verification commands:**

```bash
npm run test -w @oripa/api
npm run lint
npm run build
```

---

### CARD-013 — Local browser smoke: ops loop

**Goal:** Prove operator can process custody requests.

**Scope:**

* Local smoke:

  * seed/mock pending custody request
  * open `/ops/custody`
  * approve buyback or move redemption through lifecycle
  * verify customer item/request state updates

**Acceptance criteria:**

* Buyback credit idempotency is verified.
* Invalid transitions are blocked.
* Terminal requests cannot be edited.
* No service restart required.

**Verification commands:**

```bash
npm run test:customer:ops-lifecycle -w @oripa/api
npm run lint
npm run build
```

---

### CARD-014 — Dependency advisory review

**Goal:** Handle moderate PostCSS/Next advisory without unsafe downgrade.

**Scope:**

* Inspect installed Next/PostCSS path.
* Do not run `npm audit fix --force`.
* Prefer safe Next patch/minor upgrade only if compatible.
* Document result in `docs/security/`.

**Acceptance criteria:**

* `npm audit` status is explained.
* No forced downgrade.
* Build still passes.
* Lockfile changes are intentional and reviewable.

**Verification commands:**

```bash
npm audit
npm run lint
npm run build
npm run test -w @oripa/api
```

---

### CARD-015 — Provider adapter stubs only

**Goal:** Prepare future integrations without activating them.

**Scope:**

* Define local interface:

  * `CustodyProviderAdapter`
  * `quoteBuyback`
  * `requestRedemption`
  * `syncStatus`
* Implement `ORIPA_INTERNAL` only.
* Add disabled stubs for `COLLECTOR_CRYPT` and `PHYGITALS`.

**Acceptance criteria:**

* No real provider URLs or credentials required.
* External providers throw explicit “not configured” errors.
* Tests confirm external providers cannot activate accidentally.
* Existing custody flow still uses `ORIPA_INTERNAL`.

**Verification commands:**

```bash
npm run test:customer:phase2 -w @oripa/api
npm run lint
npm run build
```

---

## Acceptance Criteria and Verification Commands

Global acceptance criteria:

1. **Local-only**

   * No production DB writes.
   * No live migrations.
   * No gateway/service restart.
   * No deploy, push, or PR.

2. **Customer loop complete**

   * Customer can open pack, see result, choose buyback/redemption/keep, view backpack, view fairness proof, and see wallet/request history.

3. **Ops loop complete**

   * Staff can view and process custody requests through valid state transitions.

4. **Economics visible but safe**

   * UI exposes EV/value/buyback/status clearly.
   * Stale or missing value/inventory blocks pack opening.
   * No misleading return/profit claims.

5. **Fairness understandable**

   * Proof page explains reproducibility and limits.
   * No unsupported VRF/blockchain claim.

6. **Reference parity directionally achieved**

   * Oripa has equivalents for:

     * machine status
     * stock
     * odds/value bands
     * EV
     * buyback percent
     * last activity
     * customer inventory
     * redemption/buyback choice
     * proof verification
     * ops fulfillment queue.

Canonical verification suite:

```bash
npm run test
npm run lint
npx prisma validate --schema prisma/schema.prisma
npm run build
npm audit
```

Targeted verification suite:

```bash
npm run test:backend:harness -w @oripa/api
npm run test:packs:availability -w @oripa/api
npm run test:packs:inventory-allocation -w @oripa/api
npm run test:packs:publish-freeze -w @oripa/api
npm run test:draws:physical-inventory-fail-closed -w @oripa/api
npm run test:draws:pool-integrity -w @oripa/api
npm run test:draws:fairness-golden-vectors -w @oripa/api
npm run test:customer:phase2 -w @oripa/api
npm run test:customer:buyback -w @oripa/api
npm run test:customer:ops-lifecycle -w @oripa/api
npm run test:customer:wallet -w @oripa/api
```

Forbidden commands for this queue:

```bash
npm run db:migrate
npm run db:migrate:deploy
npm run db:indexes:catalog
npm run db:seed
npm run dev
npm run start
git push
```

Allowed only if explicitly local and reviewed:

```bash
npm run db:generate
npx prisma validate --schema prisma/schema.prisma
```

---

## Safety Gates

### Hard stop gates

Stop and escalate if any task requires:

* hosted/production `DATABASE_URL`
* production DB write
* live migration
* real payment provider credential
* real shipping provider credential
* live Collector Crypt or Phygitals write
* gateway/service restart
* deploy
* push
* PR
* public launch switch

### Fail-closed product gates

Pack opening must be blocked when:

* pack is draft/archived/inactive
* emergency stop is active
* stock is insufficient
* pool snapshot hash is missing
* physical inventory proof is missing
* value policy is stale
* user is unauthenticated
* profile is incomplete
* wallet balance is insufficient

### Copy/legal gates

Do not use:

* “guaranteed profit”
* “risk-free”
* “investment”
* “100% return”
* “provably fair blockchain verified” unless actually backed by public-chain commit/verification
* “VRF” unless VRF exists

Use:

* “estimated value”
* “value source”
* “value as of”
* “buyback quote”
* “quote expires”
* “reproducible fairness proof”
* “pool snapshot hash”

### Security gates

* Do not run `npm audit fix --force`.
* Treat current audit as known moderate advisory requiring reviewed dependency strategy.
* Do not expose internal IDs in public activity feed.
* Do not expose emails/full names outside authenticated ops/customer contexts.

---

## Evidence Notes

The evidence packet shows the current repo baseline is already strong: `npm test`, `npm lint`, Prisma validation, and `npm build` pass, while `npm audit` reports a moderate PostCSS/Next advisory where the suggested forced fix is unsafe because it would install an old breaking Next version. The packet also shows existing backend endpoints for customer summary/items/draws, buyback quote/accept, redemption request, ops custody queue, pack availability, draw fairness, and inventory allocation. 

The public reference captures show Phygitals and Collector Crypt expose product confidence fields Oripa should mirror conceptually: EV, min/max value, buyback percent, machine status, stock, odds, tier ranges, free/turbo/points incentives, and activity/status fields. The implementation should use those as **feature inspiration**, not as a reason to activate external adapters. 

Final priority order: **customer backpack → post-rip actions → ops custody UI → economics/status projection → activity feed → fairness copy → local smoke tests → dependency advisory review → provider stubs.**


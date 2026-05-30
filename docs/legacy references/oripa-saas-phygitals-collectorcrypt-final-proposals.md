# Oripa SaaS — Phygitals + Collector Crypt Reference Proposal

Status: final research handoff after Oracle audit loop 2026-05-28.

Audience: `@HRMcodingbot` and Oripa SaaS product/implementation work.

Scope: public unauthenticated reference surfaces only. No purchases, no authenticated actions, and no successful mutation flows were performed or used as product evidence. Non-read endpoints were identified only as excluded recon context and are intentionally not product-roadmap evidence.

## 1. Evidence standard

All public-site/API observations are **snapshot observations as of 2026-05-28** and may change. Numeric counts and field distributions below are only valid for the captured artifacts.

For fuller source-surface inventory and intermediate reference notes, see `docs/reference-phygitals-collectorcrypt-reverse-engineering.md`.

Evidence artifacts copied into the repo:

- `docs/reference-artifacts/2026-05-28/phygitals_available.json`
  - SHA256: `5bde315176de47f573a6ccde5b156ad27b103a48a9c57ac0a7c1346d634f1739`
- `docs/reference-artifacts/2026-05-28/collectorcrypt_status.json`
  - SHA256: `d24aa016e6639fb1b590c2f092700efa70889473d5a0bf52948dbbaf24da8476`
- `docs/reference-artifacts/2026-05-28/collectorcrypt_stats.json`
  - SHA256: `8ec97ed3d678bc8cacd8703bbf17d91151409f552ebf97d013852efe9ecc5a2d`
- `docs/reference-artifacts/2026-05-28/page_api_summary.json`
  - SHA256: `cae2dd4ef1a4a0063e97589abacd32d83900de907da51c2bae7cdfe78a490df7`
- `docs/reference-artifacts/2026-05-28/collectorcrypt_gacha_api_tests.json`
  - SHA256: `736e074257cfb263458456d593996ea22439718c106bb4ccd0e59e36a203e7e1`

Local repo evidence commit at research time: `e22305b`.

Oracle audit artifacts:

- Round 1: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/manual_oripa_phygitals_collectorcrypt_audit.md`
  - Verdict: directionally sound, but required stronger evidence separation, repo artifacts, scope cleanup, and clearer MVP/roadmap priority. Those edits are incorporated in this final handoff.
- Round 2: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/manual_oripa_phygitals_collectorcrypt_audit_round2.md`
  - Verdict: `PASS`; no required edits; minor optional improvements only. The material optional edits were incorporated after the pass.

## 2. Executive answer

Phygitals and Collector Crypt are persuasive because they do **not** sell only a spin animation. They sell a full trust loop:

`choose pack → pay/open → reveal a real/vaulted collectible → own a durable asset representation → choose post-draw action: keep, convert/sell back, list/trade, or ship → inspect enough proof/history to trust the machine`

For Oripa SaaS, the customer-facing promise should therefore move from generic “mystery pack gacha” to:

> Near-term Oripa promise: launch TCG mystery-pack storefronts where buyers can browse packs, complete wallet-backed idempotent draws, receive durable owned prize records, and view proof/history for each paid result once proof UX is shipped.

Roadmap promise:

> Add value-band odds, EV transparency, buyback/convert-to-points, fulfillment, recent winners, and marketplace loops only after the ownership/proof/ledger foundations are stable.

Do **not** claim vaulting, worldwide shipping, public VRF, blockchain ownership, marketplace trading, free packs, or fixed buyback percentages until those features exist and are operationally verified.

## 3. Current Oripa code evidence

Source commit: `e22305b`.

- Draw route uses JWT auth helpers:
  - `apps/api/src/modules/draws/router.ts:7` imports `jsonwebtoken`.
  - `apps/api/src/modules/draws/router.ts:45` verifies token with `jwt.verify(...)`.
- Draw route has idempotency scope:
  - `apps/api/src/modules/draws/router.ts:116` builds `${vendorId}:draw:${actorUserId}:${rawIdemKey}`.
  - `apps/api/src/modules/draws/router.ts:132` checks existing `idempotencyKey`.
  - `apps/api/src/modules/draws/router.ts:387` upserts idempotency result.
- Draw route runs a serializable transaction:
  - `apps/api/src/modules/draws/router.ts:435` uses `Prisma.TransactionIsolationLevel.Serializable`.
- Draw route is vendor/user scoped for draw and wallet debit path:
  - `apps/api/src/modules/draws/router.ts:137` finds pack by `id`, `vendorId`, `isActive`.
  - `apps/api/src/modules/draws/router.ts:142` finds wallet by `vendorId_userId`.
  - `apps/api/src/modules/draws/router.ts:454` proof lookup requires `drawOrderId`, `vendorId`, `userId`.
- Proof API exists in draw router:
  - `apps/api/src/modules/draws/router.ts:488-489` returns human verification instructions.
- Wallet route is not customer-ready:
  - `apps/api/src/modules/wallet/router.ts:8-11` checks vendor but calls `walletAccount.findFirst({ where: { vendorId: req.vendorId }})`, not authenticated `vendorId + userId`. This can return the first vendor wallet and must be fixed before customer wallet claims.
- Schema has wallet/proof/idempotency foundations:
  - `prisma/schema.prisma:227` `model WalletAccount`.
  - `prisma/schema.prisma:269` `model IdempotencyKey`.
  - `prisma/schema.prisma:336` `model DrawFairnessProof`.
- Current `PackPrize` metadata is too thin for reference-inspired collectible metadata:
  - `prisma/schema.prisma:195` starts `model PackPrize`.
  - It needs additional public merchandising/value/collectible lifecycle fields before Phygitals/CollectorCrypt-style claims.

## 4. Phygitals reverse engineering

### 4.1 Public positioning

Phygitals markets itself around “Real Cards, Owned Digitally.” Its public positioning emphasizes:

- opening packs of real graded cards;
- instant digital ownership;
- shipping to the door or selling on the marketplace;
- vault partners / insured storage / tracked delivery as trust signals;
- live odds and public VRF as fairness/trust claims;
- instant cash-back / buyback percentages as regret reduction.

Important: these are **Phygitals marketing claims**, not independently verified operational facts.

### 4.2 Public pack/API observations at crawl time

From `phygitals_available.json`, at crawl time:

- 125 public pack rows were returned by `https://api.phygitals.com/api/vm/available?includeRepacks=true`.
- Category counts in the artifact: Pokemon 55, One Piece 22, Baseball 5, Basketball 5, Football 3, Yu-Gi-Oh 1, plus 34 with null primary category.
- Prices ranged from `$10` to `$10,000` in the artifact.
- Buyback percentage distribution in the artifact: 85% on 75 packs, 90% on 38 packs, 92% on 11 packs, 100% on 1 pack.
- Observed row fields include pack identity, category, enable/in-stock state, price, EV, min/max EV, buyback percent, rarity/value-band distribution, reward metadata, creator/variant context, and chase context.

### 4.3 Product lessons for Oripa

- Phygitals markets physical legitimacy as a conversion/trust signal.
- EV/value is a storefront surface, not just an internal calculation.
- Odds are easier to sell as value bands than raw prize rows.
- Buyback/convert reduces regret and keeps the loop moving.
- Pack variants/price tiers increase browsing depth.
- Vault/shipping/marketplace claims should be gated behind real fulfillment operations.

## 5. Collector Crypt reverse engineering

### 5.1 Public positioning

Collector Crypt positions the product as a vault and marketplace for real-world collectibles:

- secure vaulting;
- authenticated/scanned assets;
- user profile or wallet linkage;
- buy/sell/transfer semantics;
- gacha app layered on top of tokenized/vaulted asset semantics.

These are **Collector Crypt marketing/product claims**, not independent verification of vault operations.

### 5.2 Public API observations at crawl time

From `collectorcrypt_status.json`, at crawl time:

- `https://gacha.collectorcrypt.com/api/status` returned active machine status and 32 gacha definitions.
- Observed pack/gacha fields include `code`, `name`, `price`, `status`, and `isOpen`.
- Observed statuses in the artifact: 11 open and 21 closed.
- Observed price tiers in the artifact include 25, 50, 75, 80, 100, 250, 1000, 2500, and 5000.
- Observed codes include examples like `pokemon_50`, `pokemon_250`, `pokemon_1000`, `onepiece_250`, and `pokemon_25`.

From `collectorcrypt_stats.json`, at crawl time:

- `https://gacha.collectorcrypt.com/api/stats?data=linkedSendNftAndSpinTxns` returned operational event rows with spin/send timestamps, wallet addresses, transaction signatures, NFT address, memo, and roll.

Rendered prize-card visual claims require screenshot evidence and are **not** used as hard product requirements in this final proposal. The durable product lesson is from API/status/trace patterns: public pack codes, open/closed states, recent operational history, and chain-of-custody style records.

### 5.3 Product lessons for Oripa

- Pack availability status should be first-class and consistent across list/detail/draw.
- Human-readable pack codes are useful for URLs, support, and customer memory.
- Recent winner/activity feeds can build trust, but must be privacy-safe and reversible/adjustable.
- Even without blockchain, Oripa should model chain-of-custody: wallet debit → draw order → proof → owned prize inventory → convert/ship/support status.
- The actual product is post-draw ownership, not only result reveal.

## 6. Final CAR proposals

### PHY-CAR-01 — Durable prize ownership

- **Challenge:** Buyers hesitate when a pack result feels like a temporary animation instead of ownership of a real collectible.
- **Action:** Convert each successful paid draw into a durable user-owned prize inventory record linked to pack, prize metadata, draw order, wallet ledger, proof, and post-draw status.
- **Result:** Customers can revisit and manage won prizes after the reveal, enabling future convert, fulfill, support, and marketplace flows.

### PHY-CAR-02 — Value-band odds

- **Challenge:** Full prize tables are hard to interpret and can make pack risk feel opaque.
- **Action:** Add pack-level value-band odds with lower/upper value range, probability/weight, display metadata, and last-calculated timestamp.
- **Result:** Customers can quickly understand downside, mid-tier probability, and chase upside before spending.

### PHY-CAR-03 — EV transparency with stale-state guardrails

- **Challenge:** Premium packs need a defensible risk/reward explanation.
- **Action:** Store/display EV, min/max estimated value, and last-updated timestamp only when calculation is fresh and reconciled to the active prize pool.
- **Result:** Vendors can explain high-price packs with clearer economics while suppressing stale or unsupported claims.

### PHY-CAR-04 — Convert-to-points / buyback loop

- **Challenge:** Low-value or duplicate pulls create regret and unnecessary support/fulfillment load.
- **Action:** Allow eligible owned prizes to convert back to points through an idempotent, ledger-backed transaction with policy/version recorded.
- **Result:** Customers get a second-chance loop, while vendors reduce unwanted physical fulfillment requests.

### PHY-CAR-05 — Pack families and variants

- **Challenge:** Customers with different budgets need an easy way to move between risk/price levels.
- **Action:** Group related packs by family and variants with display labels, prices, availability, and risk labels.
- **Result:** Customers can ladder between starter, mid-tier, and chase packs without re-learning the category.

### PHY-CAR-06 — Reference-inspired collectible metadata

- **Challenge:** High-value prizes need enough context to feel real and supportable.
- **Action:** Add optional metadata for grade, certifier, cert number, condition, appraised/insured value, image, vault/fulfillment eligibility, and source.
- **Result:** Oripa can show stronger collectible context while avoiding vault/shipping claims until operations exist.

### CC-CAR-01 — Shared availability state

- **Challenge:** Trust drops when a pack appears available in one place but fails at draw time.
- **Action:** Implement a shared availability service with reason codes used by list, detail, and draw paths.
- **Result:** Customers see accurate CTA states before attempting a draw, reducing failed-action moments.

### CC-CAR-02 — Human-readable pack codes

- **Challenge:** Opaque IDs are bad for URLs, support, and customer memory.
- **Action:** Add vendor-scoped pack codes/slugs such as `pokemon_50` while retaining internal IDs for relations.
- **Result:** Customers and support can discuss packs using stable, memorable references.

### CC-CAR-03 — Privacy-safe recent winners feed

- **Challenge:** New users wonder whether real prizes are actually being won.
- **Action:** Publish an optional feed of completed, non-reversed draws with masked identifiers, pack code, prize summary, timestamp, and optional proof link.
- **Result:** The storefront feels live without exposing raw account identifiers or irreversible false history.

### CC-CAR-04 — Chain-of-custody support trace

- **Challenge:** Draw disputes are hard if payment, RNG, prize assignment, and post-draw action are separate records.
- **Action:** Link wallet ledger entry, draw order, draw result, fairness proof, prize inventory item, audit log, and support lookup under traceable IDs.
- **Result:** Support can reconstruct events without engineering database access.

### CC-CAR-05 — Database-native tokenized ownership semantics

- **Challenge:** Customers value immediate ownership semantics even if the app is not blockchain-based.
- **Action:** Treat a won prize as a unique owned asset with metadata, state, source draw, and allowed actions.
- **Result:** Oripa can deliver hold/convert/ship/list semantics with conventional database infrastructure.

### CC-CAR-06 — Free/demo packs only after abuse controls

- **Challenge:** Free packs can acquire users but invite abuse and legal/commercial confusion.
- **Action:** Defer free/demo packs until eligibility, anti-abuse, ledger semantics, inventory semantics, and support lookup are stable.
- **Result:** Vendors can experiment later without undermining inventory integrity or trust.

## 7. Final customer stories

### STORY-PHY-01 — View value bands before drawing

- **As a** collector,
- **I want** to see value-band odds and expected value before opening a pack,
- **so that** I understand risk/reward before spending points.

Acceptance criteria:

- Pack detail shows value bands with lower/upper range and probability/weight.
- EV/min/max values render with last-updated timestamp if present.
- Odds/EV display is suppressed or marked stale if last calculation exceeds configured threshold.
- Published odds bands reconcile to the active prize pool before pack publish.
- Missing EV does not block pack display but suppresses EV claims.

### STORY-PHY-02 — Convert a won prize back to points

- **As a** player,
- **I want** to convert eligible wins back into points,
- **so that** I can keep playing instead of shipping cards I do not want.

Acceptance criteria:

- Won prize inventory row displays return amount or buyback percentage before action.
- Conversion endpoint is idempotent.
- Conversion is blocked unless inventory status is `owned` and eligible.
- Conversion and wallet credit occur in one transaction.
- Buyback policy source/version is recorded.
- Converted prizes cannot be converted or shipped again.
- Support lookup shows source draw, conversion event, and ledger credit.

### STORY-PHY-03 — Navigate related pack variants

- **As a** returning collector,
- **I want** to move between related pack tiers and variants,
- **so that** I can choose the budget and risk level I want today.

Acceptance criteria:

- Pack detail page shows related packs in the same family.
- Variants have display order, label, price, availability, and optional risk label.
- Active variant is URL-addressable.
- Draw API only accepts the selected actual pack ID/code.

### STORY-PHY-04 — See collectible credibility for premium wins

- **As a** high-value buyer,
- **I want** premium prizes to show grade, certifier, appraised/insured value, and fulfillment eligibility where available,
- **so that** I know what I won and what actions are supported.

Acceptance criteria:

- Prize metadata supports certifier, grade, cert number, appraised/insured value, condition, image, source, and fulfillment eligibility.
- UI only displays fields that are populated and verified.
- Shipping/vault claims are disabled unless fulfillment workflow exists.

### STORY-CC-01 — Know whether a pack is open before attempting draw

- **As a** player,
- **I want** every pack to show open/closed/sold-out/eligibility status,
- **so that** I do not try to draw unavailable packs.

Acceptance criteria:

- List and detail show the same availability reason returned by API.
- Draw API enforces the same state.
- CTA copy changes for closed/sold-out/auth/insufficient-balance/limit states.

### STORY-CC-02 — Revisit a recent winner/proof feed

- **As a** prospective player,
- **I want** to see recent wins in a privacy-safe feed,
- **so that** I can trust the machine is active and prizes are real.

Acceptance criteria:

- Feed shows masked user, pack, prize summary, timestamp, and optional proof/result link.
- Feed only includes completed, non-reversed draws.
- Feed hides or masks account identifiers by default.
- Feed item is removed or marked adjusted if the underlying draw is voided/refunded.
- Feed can be disabled per vendor.
- Support/admin can trace feed items to internal draw IDs.

### STORY-CC-03 — Use a memorable pack code in support conversations

- **As a** customer or support agent,
- **I want** pack codes like `pokemon_50` or `onepiece_250`,
- **so that** we can refer to packs without copying long internal IDs.

Acceptance criteria:

- Pack model has unique vendor-scoped code/slug.
- Public URLs and support lookup accept code/slug where safe.
- Internal relations still use stable IDs.
- Codes are validated for uniqueness and display safety before publish.

### STORY-CC-04 — Trace a draw from payment to prize ownership

- **As a** support agent,
- **I want** one lookup to show wallet debit, draw result, proof, prize inventory item, and post-draw action,
- **so that** I can resolve disputes without engineering help.

Acceptance criteria:

- Lookup by draw order ID, request ID, proof ID, or prize inventory ID.
- View is role-restricted and vendor-scoped.
- Shows wallet ledger, draw result, proof, inventory status, conversion/fulfillment status, and audit events.
- Lookup action is audited.

## 8. Revised implementation priority

### P0 — must ship before public/customer trust claims

1. Fix `/v1/wallet` JWT user scoping.
2. Shared pack availability/reason-code service used by list/detail/draw.
3. Durable user prize inventory created inside the successful draw transaction.
4. Minimal prize display metadata: prize name, image, estimated/display value, source draw, ownership status.
5. Proof page/history UX if any “fair/provable/verify” claim is made.
6. Pack code/slug for URLs/support.

### P1 — core trust/differentiation

1. Value-band odds and EV fields/display.
2. Admin publish validation for odds, EV, prize metadata, buyback, and availability.
3. Buyback/convert-to-points after inventory + ledger + idempotency are stable.
4. Support trace lookup by draw/order/proof/inventory ID.
5. Pack family/variant navigation.
6. Advanced collectible metadata: grade, certifier, cert number, condition, insured/appraised value, fulfillment eligibility.

### P2 — operational lifecycle

1. Shipping/fulfillment workflow with address, fees, status, tracking, and support controls.
2. Privacy-safe recent winners feed.
3. Fulfillment/admin audit views.

### P3 — retention/marketplace

1. Weekly leaderboard/voucher campaigns.
2. Referral campaigns.
3. Free/demo packs with anti-abuse controls.
4. Marketplace/listing/trading.

## 9. Copy-safe messaging

Safe near-term copy after P0 is implemented:

> Oripa SaaS lets operators launch TCG mystery-pack storefronts where customers browse packs, complete wallet-backed idempotent draws, receive durable owned prize records, and inspect proof/history for each paid result.

Safe only after odds/EV implementation:

> Customers can review value-band odds and fresh EV estimates before drawing.

Safe only after buyback implementation:

> Customers can convert eligible wins back into points, reducing regret and keeping the collecting loop active.

Safe only after fulfillment implementation:

> Customers can request shipment for eligible physical prizes with tracked fulfillment status.

Unsafe until implemented and verified:

- “Ships worldwide.”
- “Fully insured vault storage.”
- “Marketplace trading.”
- “Public VRF” if Oripa remains HMAC commitment/reveal rather than public VRF.
- “85–90% buyback” unless exact economics exist.
- “Recent winners” without feed privacy, completion/reversal handling, and traceability.
- “Free packs” or “daily packs” before abuse controls.

## 10. Final handoff to `@HRMcodingbot`

Do not clone the reference sites’ retention layers first. Build the trust foundation first:

1. fix wallet auth/user scoping;
2. add shared availability reason codes;
3. add durable user prize inventory inside successful draw transaction;
4. add proof page/history UX;
5. add pack code/slug and minimum prize metadata;
6. add odds/EV value bands and publish validation;
7. add convert-to-points/buyback;
8. add support trace lookup;
9. add richer collectible metadata and fulfillment;
10. add recent winners, referral/free/demo, leaderboard, and marketplace only after the above is stable.

This gives Oripa a reference-inspired trust-signaling architecture—visible value, post-draw ownership records, proof UX, and traceability—without claiming vault, blockchain, marketplace, or shipping capabilities before they exist.

# Packs.com Public-Reference Analysis — CAR + Customer Stories for Oripa SaaS

Status: two-pass Oracle reviewed public reference analysis from Packs.com site, rendered homepage content, public API responses, bundled frontend route/API strings, Terms page extract, and Packs.com Help Center provably-fair article. Safe as a source-classified fourth reference for planning only; preserve evidence classes during reconciliation.
Audience: `@HRMcodingbot` and Oripa SaaS implementation planning.
Date: 2026-05-29.

## Scope and evidence

This document analyzes Packs.com only as a public product/reference input for Oripa SaaS planning. It is not a claim that Oripa should copy Packs.com verbatim.

> **Do not import directly.** Treat this file as a source-classified reference. Anything labeled `direct_public_copy`, `direct_public_api`, or `frontend_string_inference` is evidence about what was publicly visible at probe time, not proof that the underlying Packs.com implementation, legal posture, payment rails, fulfillment operations, or fairness system work as marketed. Anything labeled `oripa_recommendation` is an Oripa planning recommendation, not a Packs.com fact.

Claims in this document are evidence-classified as:

- `direct_public_copy`: visible marketing/help/terms text.
- `direct_public_api`: unauthenticated public API response observed at probe time.
- `frontend_string_inference`: route/API/string present in bundled frontend assets, not executed.
- `account_flow_inference`: inferred from copy/strings; not executed.
- `oripa_recommendation`: planning recommendation derived from the reference, not a Packs.com fact.

### Evidence IDs and claim support

During reconciliation, every imported source-derived claim, CAR, story, or implementation delta should carry forward one or more evidence IDs and its evidence class.

- **E1 — Packs.com homepage rendered extract**
  - Captured at: 2026-05-29.
  - Method: rendered text extract / public page metadata.
  - Supports: public marketing copy, navigation, homepage claims.
  - Limitations: marketing copy only; not independent verification.
- **E2 — Packs.com Terms rendered extract**
  - Captured at: 2026-05-29.
  - Method: rendered text extract.
  - Supports: terms claims about inventory, fulfillment, sell-back, refunds, restrictions, and marketplace.
  - Limitations: legal text only; not proof of actual implementation. Exact excerpts must be reattached before importing timing/finality language.
- **E3 — Packs.com Help Center provably-fair article**
  - Captured at: 2026-05-29.
  - Method: rendered article extract.
  - Supports: described seed/hash/nonce/ticket design.
  - Limitations: article claim only; implementation not independently verified; no test vectors captured.
- **E4 — `https://api.packs.com/health`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: public health exposure.
  - Limitations: exact response fields should be retained before treating it as a security finding.
- **E5 — `https://api.packs.com/cases`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: public case list fields/count at probe time.
  - Limitations: mutable data; count may change.
- **E6 — `https://api.packs.com/cases/{slug}`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: sampled case detail item/chance/value fields.
  - Limitations: sampled slug only unless multiple slugs are captured.
- **E7 — `https://api.packs.com/cases/{slug}/stats`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: recent opening stats fields.
  - Limitations: public projection only; not proof of full history.
- **E8 — `https://api.packs.com/packs`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: pack list fields/count at probe time.
  - Limitations: mutable data; count may change.
- **E9 — `https://api.packs.com/packs/{slug}`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: sampled slot/item/chance structure.
  - Limitations: sampled slug only unless multiple slugs are captured.
- **E10 — `https://api.packs.com/cards?limit=3`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: public card metadata fields.
  - Limitations: sample only.
- **E11 — `https://api.packs.com/cards/{id}`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: individual card metadata fields.
  - Limitations: sampled card only.
- **E12 — `https://packs.com/static/js/index.8038ae39.js`**
  - Captured at: 2026-05-29.
  - Method: bundled frontend string inspection.
  - Supports: route/API string evidence.
  - Limitations: string presence is not proof an endpoint is active, reachable, legally available, or customer-enabled.
- **E13 — `https://api.packs.com/cards/search?q=charizard`**
  - Captured at: 2026-05-29.
  - Method: unauthenticated public API probe.
  - Supports: public error behavior.
  - Limitations: exact customer-visible error excerpt should be retained before treating it as a security finding.

Observed limitations:

- Account-only flows such as deposit, paid open, inventory actions, sell-back, order/withdrawal creation, and admin/warehouse routes were inferred from public copy and frontend API strings, not executed.
- Some public claims come from marketing/FAQ/Terms and need legal/product review before translating into Oripa copy.
- Browser automation was unavailable in the current environment, so visual interaction was reconstructed from rendered extracts, APIs, and bundled frontend strings.

## Executive findings

Packs.com is useful as a reference for end-to-end card lifecycle UX, but many lifecycle elements appear to be outside Oripa’s immediate MVP scope and must be gated before import. The public-reference product loop appears to be:

`browse themed packs/single pulls/marketplace → deposit into Coins → open Real Packs or Single Pulls via provably fair seed/ticket system → reveal real card(s) → store in Backpack/inventory → sell back for Coins or order/withdraw physical cards → track fulfillment/delivery → inspect opening history/provably-fair data`

The most useful Oripa takeaways:

1. **Trust claims are prominent, but they are source claims rather than independently verified facts.** Packs.com publicly presents claims such as “fair odds,” “authentic cards,” “1 Coin = $1,” seed/hash verification, opening history, inventory, and shipping. Oripa must gate any equivalent wording to implemented, reviewed capabilities.
2. **Two product formats are separated.** It distinguishes multi-slot Real Packs from one-card Single Pulls. This maps cleanly to Oripa as pack mode vs single-pull mode, but Oripa should gate multi-award semantics until implemented.
3. **Prize lifecycle is first-class.** Once revealed, cards enter online inventory/Backpack; users can keep, sell back for platform Coins, or order physical shipment.
4. **Some disclosure appears data-backed in sampled public API responses.** Public APIs expose price, item/card metadata, chance, rarity, category/game, volatile flags, and recent opening stats in observed samples.
5. **Provably fair is a serious implementation commitment.** Packs.com documents server seed hash, client seed, nonce, HMAC-SHA512, ticket ranges, seed rotation, history, and verification tooling. Oripa should not claim “provably fair” unless it implements comparable proof and user verification.
6. **Operations are bigger than the spin.** Bundled frontend route/API strings suggest internal/admin surfaces for case/pack creation, warehouse inventory updates, shipping labels/carriers/services/packages, withdrawal state movement, refunds, cycle counting, volatile-pricing controls, and support/error flows.
7. **Packs.com publicly markets, documents, or exposes strings for risky claims/features that Oripa should not copy without implementation, legal, payments, compliance, and support review.** These include multiple payment rails, crypto withdrawals/cashouts, marketplace purchase, sell-back/buyback, international shipping, verified/authentic claims, public provably-fair claims, and no-refund finality.

## Product surface reverse-engineered

### Public navigation / categories

Observed public nav and routes include:

- All Games / Cards.
- Magic, Pokemon, One Piece.
- `Packs` / Real Packs.
- `Single Pulls`.
- `Marketplace`.
- Login / Signup.
- Account profile surfaces: Backpack/Inventory, Opening History, Deliveries, Transactions, Provably Fair.

Oripa implication:

- Keep Oripa’s MVP category model simple but explicit: game/category, pack family/tier, pack mode, status, price, and supported actions.
- Do not expose marketplace/inventory/sell/shipping nav until the backend and policy are implemented.

### Homepage value proposition

Packs.com copy emphasizes:

- “REAL CARDS. SHIPPED TO YOU.”
- “Open iconic packs online. Pull the real cards.”
- “Packs are our own creation, filled with genuine cards.”
- “Fair odds.”
- “Authentic cards.”
- “1 Coin = $1.”
- “Peel to Open.”
- “Experience that feels real.”
- “Open instantly, see what you pulled, and get them shipped to your door.”

Oripa implication:

- Oripa can borrow the structure of trust messaging but must keep claims capability-gated.
- Safe Oripa wording before full operations: “wallet-backed draws,” “durable prize records,” “draw-time snapshot,” “eligible fulfillment through support/admin.”
- Unsafe until implemented and reviewed: “authentic,” “verified,” “insured,” “worldwide shipping,” “provably fair,” “1 point = $1,” “cash out,” “sell back.”

### Product formats

Observed formats:

- **Real Packs / Packs:** multi-slot products. Public `/packs/{slug}` response exposes `slots`, each with bucket/index/items/chances.
- **Single Pulls / Cases:** one-card curated pulls. Public `/cases/{slug}` response exposes an item list with `chance`, `rarity`, price bands, and average price.
- **Marketplace:** public navigation, terms text, and bundled frontend strings suggest a known-card purchase lane. No marketplace purchase flow was executed in this artifact.

Oripa implication:

- Model pack mode explicitly:
  - `single_pull`: exactly one awarded user prize.
  - `multi_slot_pack`: N slots, each independently resolved and snapshotted.
  - `marketplace_purchase`: roadmap/non-MVP unless built.
- The reconciled Oripa proposal should keep one-prize MVP unless multi-slot semantics are explicitly implemented.

### Coins / funding / payments

Observed:

- Homepage says `1 COIN = $1`.
- Public copy/FAQ material captured in the rendered homepage or terms extract says users deposit and receive Coins; exact source excerpt must be attached as an evidence item before reconciliation.
- Frontend strings/API include deposit methods and region-dependent payment rails: card, PayPal, ACH, Apple Pay / Google Pay, crypto, and affiliate bonus Coins.
- Bundled frontend strings include endpoint-like paths such as `/secure/payments/deposit`, `/secure/payments/deposits`, `/secure/payments/cashout`, `/secure/payments/cashouts`, `/secure/payments/withdrawal`, `/secure/payments/withdrawals`, and cancel withdrawal.
- Do not infer that these endpoint-like strings are active, reachable, legally available, or customer-enabled. Treat them as frontend-string evidence only until account-level flows are tested or formally excluded.

Oripa implication:

- Packs.com reinforces the need for one explicit launch funding path and exact copy matching that path.
- Oripa should not copy multiple rails or crypto/cashout until payments, KYC/AML/legal, ledger, refunds, and support are real.
- If Oripa uses points, it should define whether `1 point = $1`, promotional points, refunds, returns, and admin adjustments share the same ledger semantics.

### Odds, chance, prices, and metadata

Observed public API examples:

- `/cases` returned 126 cases in one unauthenticated probe on 2026-05-29; treat this as mutable public API evidence, not a stable product fact. Each case includes fields such as `_id`, `name`, `slug`, `image`, `category`, `description`, `price.usd`, `risk`, `hidden`, timestamps, and detail `items`.
- `/cases/eternities` item example includes `name`, `image`, `price.min.usd`, `price.max.usd`, `averagePrice.usd`, `rarity`, `chance`, `tickets`, variants, maker/category, and extra data.
- `/packs` returned 14 packs in one unauthenticated probe on 2026-05-29; treat this as mutable public API evidence, not a stable product fact. Pack list includes `name`, `slug`, `game`, `price.usd`, `setCodes`, `hidden`, `categories`, `minPrice`, `freePackPool`, timestamps.
- `/packs/{slug}` exposes `slots`; each slot has bucket/index/items, and each item exposes `cardId`, `name`, `image`, `rarity`, `chance`, `tickets`, and `averagePrice.usd`.
- `/cards` exposes game, image, TCGPlayer-like ID, number, rarity, set, setCode, condition/printing/language/sku/price/lastUpdated, variants, volatility, and hidden flags.
- `/cases/{slug}/stats` exposes recent openings with item/card metadata and acquisition source.
- For implementation planning, field presence in sampled responses is enough to inform Oripa schema candidates, but not enough to prove Packs.com’s internal ledger, fulfillment, pricing, or fairness behavior.

Oripa implication:

- Oripa should preserve draw-time disclosure snapshots for price, visible odds/chance, item/prize metadata, value/source timestamp, pack config version, and selection algorithm version.
- If odds are shown, they must be generated from the same draw pool used by the transaction.
- Volatile-price logic is relevant: hide or disable order/market actions for items with stale/volatile prices rather than showing unsafe values.

### Provably fair implementation

The Packs.com Help Center article states the following design; this document does not independently verify that the production implementation matches the article:

- Uses server seed, client seed, nonce.
- Shows SHA-256 hash of server seed before gameplay.
- Uses HMAC-SHA512 to derive ticket numbers from seeds/nonce.
- Maps ticket to 0–99,999,999 ticket range.
- Simple Pack: `serverSeed:clientSeed:nonce:openingNumber`.
- Complex Pack: slot-specific domain separation using `openingNumber-slotIndex` suffix.
- Server seed is rotated after every opening; previous server seed is revealed/stored in history.
- Users can change client seed.
- Opening history shows server seed, client seed, nonce, and tickets for verification.

Oripa implication:

- This is a useful proof design reference if Oripa wants a true “provably fair” claim.
- Minimum Oripa safe implementation for proof should include: pre-commitment hash, client seed, nonce, algorithm version, ticket/range mapping, draw-time pool snapshot, seed reveal/rotation, and customer verification page/tool.
- If Oripa only has an internal audit record, call it “draw audit record” or “snapshot,” not “provably fair.”
- Do not implement Oripa’s cryptographic proof system solely from this reference. A public verifier, seed lifecycle, nonce semantics, ticket mapping, domain separation, replay behavior, and audit retention require security review and test vectors.

### Inventory / Backpack / sell-back / fulfillment

Observed:

- FAQ says pulled cards go to inventory and users click “Order Cards” when ready.
- Terms extract appears to state that revealed cards are stored in online inventory and describes options including physical shipment, leaving cards in inventory, or selling back for Coins. Exact terms excerpts must be attached before importing any timing, refund, sell-back, or finality language into Oripa.
- UI strings mention Backpack, selected items, total value, sell, order cards, delivery, withdrawal, shipping tokens, and volatile-pricing restrictions.
- Bundled frontend strings include endpoint-like paths or labels for inventory get/sell/trade, withdrawal create/cancel, warehouse order/pack, shipping carriers/services/packages, generate label, status movement, refunds, and order update.
- The word “withdrawal” is ambiguous and must be normalized for Oripa. It may refer to payment withdrawal/cashout in some contexts and physical card/order withdrawal in others. Oripa should use separate terms: `cashout`, `return_to_points`, and `physical_fulfillment`.

Oripa implication:

- Durable prize inventory is not optional if physical/card prizes are involved.
- Sell-back/return-to-points and fulfillment must be mutually exclusive through locked state transitions.
- Physical fulfillment needs request idempotency, address/PII controls, shipping region rules, admin workflow, item locks, and support trace.
- If Oripa does not have fulfillment ready, it must hide physical shipping/delivery claims.

### Marketplace

Observed:

- Homepage/footer nav includes Marketplace.
- Terms extract says marketplace allows straight purchases of pre-identified cards.
- Frontend strings include `/market`, `/market/card/`, marketplace cart, marketplace purchase order, and market card search/build/manual batch/intake flows.

Oripa implication:

- Marketplace is a roadmap feature, not MVP.
- If later implemented, it is separate from mystery-pack draw semantics: known card, known condition, known price, fulfillment at purchase, no draw proof needed.

### Operational/admin surface

Bundled frontend strings suggest:

- Admin case create/update.
- Custom pack set upsert/delete/force materialize.
- Warehouse inventory item update.
- Cycle counting and inventory adjustments.
- Shipping label generation, carriers/services/packages.
- Withdrawal status movement from packed to shipping.
- Refund order and refund items.
- Public health endpoint appears to expose service status; exact response fields should remain attached in the evidence ledger before this becomes a security finding.
- `/cards/search?q=charizard` probe appeared to return a customer-visible ObjectId cast-style error; exact error excerpt should remain attached in the evidence ledger before this becomes a security finding.

Oripa implication:

- The operational system is part of product quality, not back-office afterthought.
- Do not expose internal service health details or raw database errors publicly.
- Admin/import/publish validation and support lookup are launch-safety features for Oripa.

## Terminology normalization for Oripa

Use these Oripa terms in the reconciled proposal:

- `product_mode`: canonical backend mode for a purchasable or playable product.
- `single_pull`: one random prize result.
- `one_prize_pack`: Oripa MVP mystery-pack mode that awards exactly one user prize.
- `multi_slot_pack`: pack mode that resolves multiple explicit slots and creates multiple user prize records.
- `marketplace_purchase`: known-item purchase with no random draw.
- `demo_opening`: non-value-bearing simulated opening unless explicitly implemented as a promo flow.
- `userPrize`: durable owned prize record created by a successful draw or purchase.
- `return_to_points`: surrendering an eligible `userPrize` for platform points under policy.
- `cashout`: conversion of platform balance to external money or crypto; excluded unless legally and operationally implemented.
- `physical_fulfillment`: request/order/shipment of a physical prize.
- `draw audit record`: internal record of draw inputs, pool snapshot, result, and ledger movement.
- `provably fair verification`: customer-verifiable seed/hash/nonce/ticket proof with public verifier or plain-English verification steps.

Avoid using `withdrawal` without a qualifier. Use `cashout` for monetary withdrawal and `physical_fulfillment` for shipping/ordering physical prizes. Use `Backpack` only when referring to Packs.com; use `inventory` or `userPrize inventory` for Oripa.

## Minimum Oripa state models required before implementation

### Draw/order state

Recommended states: `CREATED`, `PAYMENT_RESERVED`, `COMMITTED`, `REVEALED`, `FAILED_COMPENSATED`, `VOIDED`, `REFUNDED`, `SUPPORT_ADJUSTED`.

### User prize state

Recommended states: `AWARDED`, `AVAILABLE`, `RETURN_PENDING`, `RETURNED`, `FULFILLMENT_REQUESTED`, `FULFILLMENT_LOCKED`, `PACKED`, `SHIPPED`, `FULFILLED`, `CANCELLED`, `VOIDED`, `REMOVED`, `SUPPORT_LOCKED`.

### Fulfillment state

Recommended states: `REQUESTED`, `NEEDS_INFO`, `IN_REVIEW`, `APPROVED`, `PACKED`, `SHIPPED`, `FULFILLED`, `CANCELLED`, `REJECTED`, `LOST_OR_EXCEPTION`.

State transitions must prevent double-spend outcomes such as returned-and-shipped, fulfilled-and-returned, refunded-and-active, or duplicate userPrize creation.

## Packs.com-derived CAR proposal for Oripa

### PACKS-CAR-01 — Capability-gated trust copy
- **Source basis:** E1, E2, E3, E12.
- **Evidence class:** Mixed: `direct_public_copy`, `frontend_string_inference`, and `oripa_recommendation`.
- **Import stance:** Adopt now as a safety gate.
- **Copied-risk gate:** Yes — requires product, legal, support, fulfillment, payments, and compliance review before high-risk claim copy appears.

- **Challenge:** Packs.com’s strongest conversion copy uses high-trust claims: real cards, fair odds, authentic cards, shipped to you, provably fair, and 1 Coin = $1. Oripa risks overclaiming if copy outruns implementation.
- **Action:** Implement a copy-gate registry tied to actual feature flags/policies: proof, odds, reference value, return-to-points, fulfillment, authenticity verification, payment rails, marketplace, and cashout.
- **Result:** Oripa can adopt trust-forward messaging without legal/support mismatch.
- **Priority:** P0.
- **Acceptance:** Admin/publishing cannot display unsupported high-risk phrases; customer UI hides unsupported claims/actions; copy has safe fallback language.
- **Do not claim yet:** authentic/verified/insured/provably fair/worldwide shipping/cashout/marketplace unless fully implemented and approved.

### PACKS-CAR-02 — Explicit product mode model
- **Source basis:** E1, E5, E6, E8, E9, E12.
- **Evidence class:** Mixed: `direct_public_copy`, `direct_public_api`, `frontend_string_inference`, and `oripa_recommendation`.
- **Import stance:** Adopt now for enum boundaries; gate non-MVP modes.
- **Copied-risk gate:** No for internal enum; yes for customer-facing mode claims.

- **Challenge:** Packs.com separates Real Packs, Single Pulls, and Marketplace; Oripa can create ambiguity if one draw model tries to cover all product types.
- **Action:** Add a canonical `product_mode` enum with exact backend semantics: `one_prize_pack`, `single_pull`, `multi_slot_pack`, `marketplace_purchase`, and `demo_opening`. Define whether `single_pull` and `one_prize_pack` are truly different in Oripa; if not, collapse them before implementation.
- **Result:** Draw logic, disclosure, inventory creation, proof, and customer expectations stay aligned.
- **Priority:** P0 for single-pull/one-prize mode; P1/P2 for multi-slot; roadmap for marketplace.
- **Acceptance:** Each active pack has exactly one mode; unsupported modes cannot be published; story/ticket scope states one-prize vs multi-slot semantics.

### PACKS-CAR-03 — Public odds/chance only from transaction pool
- **Source basis:** E5, E6, E8, E9, E10, E11.
- **Evidence class:** `direct_public_api` plus `oripa_recommendation`.
- **Import stance:** Adopt now if odds/chance are displayed.
- **Copied-risk gate:** Yes — disclosure wording must match actual draw pool and policy.

- **Challenge:** Packs.com exposes `chance`, ticket ranges, item lists, and recent stats. If Oripa shows odds from stale/display-only data, disputes will follow.
- **Action:** Generate displayed odds/chance from the same versioned pool used by paid draw transaction; snapshot it at draw time.
- **Result:** Customers can trust pre-draw disclosure and post-draw explanation.
- **Priority:** P0 if any odds/chance are shown; otherwise P1.
- **Acceptance:** List/detail/draw/proof all reference same pool version; publish validation blocks odds display when pool data is incomplete/stale.

### PACKS-CAR-04 — Draw audit/provably-fair boundary
- **Source basis:** E3.
- **Evidence class:** `direct_public_copy` plus `oripa_recommendation`.
- **Import stance:** Adopt audit/snapshot boundary now; gate public provably-fair verification.
- **Copied-risk gate:** Yes — proof/fairness words require implemented verifier and review.

- **Challenge:** Packs.com’s provably-fair claim is backed by seed/hash/nonce/ticket documentation. Oripa’s current safe baseline may only support internal audit/snapshot.
- **Action:** Define two tiers: internal draw audit/snapshot and public provably-fair verification. Gate customer-facing “provably fair,” “verifiable,” “fair odds,” “verified draw,” and similar proof/fairness wording to the second tier unless legal/product explicitly approve narrower language.
- **Result:** Oripa can launch safe auditability now and add true provable fairness later without overclaiming.
- **Priority:** P0 for audit/snapshot; P1/P2 for public verifier if desired.
- **Acceptance:** Proof page states exactly what is verifiable; if public proof is enabled, it includes seed commitment, client seed, nonce, algorithm version, ticket mapping, and verifier instructions.

### PACKS-CAR-05 — Online prize inventory / Backpack
- **Source basis:** E1, E2, E12.
- **Evidence class:** Mixed: `direct_public_copy`, `frontend_string_inference`, and `oripa_recommendation`.
- **Import stance:** Adopt now for durable userPrize inventory.
- **Copied-risk gate:** No for internal records; yes for physical-card ownership/fulfillment copy.

- **Challenge:** Packs.com makes inventory the post-open home for pulled cards. Oripa cannot rely on reveal animation as the durable record.
- **Action:** Create user prize inventory records during the draw transaction with state, metadata, source draw, snapshot/proof link, and available actions.
- **Result:** Customers can return, fulfill, or support-trace prizes after leaving the result page.
- **Priority:** P0.
- **Acceptance:** Every successful MVP one-prize draw creates exactly one user prize record; multi-slot creates explicitly modeled multiple records only if enabled; inventory is user/vendor scoped.

### PACKS-CAR-06 — Return-to-points / sell-back guarded by item state
- **Source basis:** E2, E12.
- **Evidence class:** `direct_public_copy`, `frontend_string_inference`, `account_flow_inference`, and `oripa_recommendation`.
- **Import stance:** Gate unless return-to-points is a launch feature.
- **Copied-risk gate:** Yes — wallet, refund, value, and forfeiture policies required.

- **Challenge:** Packs.com offers sell-back to Coins; this is conversion-positive but high risk if double-credit, volatile values, or fulfillment conflicts are possible.
- **Action:** Translate sell-back into Oripa return-to-points only after preview, confirmation, idempotent ledger credit, price/value policy, and inventory state locking are implemented.
- **Result:** Customers can recover platform value without corrupting funds or fulfillment.
- **Priority:** P1 if advertised; hidden otherwise.
- **Acceptance:** Returned prizes cannot be fulfilled; fulfillment-pending/fulfilled/locked/removed/volatile/non-owned prizes cannot be returned; duplicate return cannot double-credit. `return_to_points` amount is derived from a documented policy, not from stale display value. Paid points and promotional points are credited according to wallet policy. Return events are irreversible unless an explicit admin reversal flow exists.
- **Do not claim:** cash buyback, crypto withdrawal, fixed buyback %, or instant sellback unless built and approved.

### PACKS-CAR-07 — Fulfillment and delivery foundation
- **Source basis:** E1, E2, E12.
- **Evidence class:** `direct_public_copy`, `frontend_string_inference`, `account_flow_inference`, and `oripa_recommendation`.
- **Import stance:** Gate unless physical fulfillment is launch scope.
- **Copied-risk gate:** Yes — physical operations, regions, support, and legal copy required.

- **Challenge:** Packs.com’s core promise is “real cards shipped to you,” backed by order/withdrawal/shipping operations. Oripa must not promise shipping without operations.
- **Action:** Implement authenticated fulfillment request, address capture/PII controls, item locks, region rules, admin pack/ship workflow, customer-safe statuses, and support trace.
- **Result:** Physical-prize promises become supportable.
- **Priority:** P0 if physical prizes are promised at launch; otherwise hidden/P1.
- **Acceptance:** Fulfillment locks return-to-points; status changes are audited; shipment copy matches actual region/carrier/tracking capabilities. Fulfillment state machine is separate from `userPrize` ownership state but cannot conflict with it. Physical inventory mismatch, lost item, damaged item, replacement, cancellation, and refund/support adjustment paths are defined before public shipping promises.

### PACKS-CAR-08 — Marketplace as separate roadmap lane
- **Source basis:** E1, E2, E12.
- **Evidence class:** `direct_public_copy`, `frontend_string_inference`, and `oripa_recommendation`.
- **Import stance:** Roadmap; do not import into MVP.
- **Copied-risk gate:** Yes for marketplace purchase/refund/fulfillment claims.

- **Challenge:** Packs.com has a marketplace for known-card purchase. Mixing marketplace semantics with mystery draws can confuse customers and implementation.
- **Action:** Keep marketplace out of Oripa MVP; reserve data model concepts only where cheap, but hide routes/buttons/copy.
- **Result:** MVP remains focused on safe draw + inventory + support.
- **Priority:** Roadmap.
- **Acceptance:** Marketplace UI/API is absent unless end-to-end purchase, price, fulfillment, refund, and support flows exist.

### PACKS-CAR-09 — Volatile/stale price handling
- **Source basis:** E10, E11, E12.
- **Evidence class:** `direct_public_api`, `frontend_string_inference`, and `oripa_recommendation`.
- **Import stance:** Adopt as value-display safety when values are shown.
- **Copied-risk gate:** Yes for payout/return/value-equivalence copy.

- **Challenge:** Packs.com UI strings disable order/sell actions when selected cards have volatile pricing. Oripa reference values can mislead if stale.
- **Action:** Track value source, timestamp, volatility/staleness, and action eligibility. Disable or route to support when value is stale/volatile.
- **Result:** Reference values support trust without becoming false payout/insurance promises.
- **Priority:** P1 for reference-value display; P0 if return-to-points depends on values.
- **Acceptance:** Value-dependent actions require fresh approved value; stale values show safe copy and no unsupported payout action.

### PACKS-CAR-10 — Opening history and customer verification UX
- **Source basis:** E3, E7, E12.
- **Evidence class:** `direct_public_copy`, `direct_public_api`, `frontend_string_inference`, and `oripa_recommendation`.
- **Import stance:** Adopt history/support record now; gate public proof fields to proof capability.
- **Copied-risk gate:** Yes for verification/provably-fair claims.

- **Challenge:** Packs.com directs users to opening history for server seed, client seed, nonce, and tickets. Oripa needs a durable history page even if proof is internal.
- **Action:** Build customer opening history with draw order/result, prize inventory link, disclosure snapshot, audit/proof status, return/fulfillment status, and support ID.
- **Result:** Customers can understand and support can resolve each opening.
- **Priority:** P0/P1 depending on proof/copy claims; P0 for paid draw history.
- **Acceptance:** History remains available after pack archive, return, fulfillment, refund, or support adjustment.

### PACKS-CAR-11 — Public recent stats/projections with privacy controls
- **Source basis:** E7.
- **Evidence class:** `direct_public_api` plus `oripa_recommendation`.
- **Import stance:** Roadmap/P2 only.
- **Copied-risk gate:** Yes — privacy and reversal policy required.

- **Challenge:** Packs.com exposes recent case stats. Public proof of activity converts, but can leak user/state data or display reversed draws.
- **Action:** Add optional public projection only from completed, non-reversed draw records, anonymized by default and traceable internally.
- **Result:** Storefront can show activity without unsafe identity or reversal issues.
- **Priority:** P2.
- **Acceptance:** Feed can be disabled per vendor; voided/refunded/support-adjusted events are removed or marked according to policy.

### PACKS-CAR-12 — Admin/warehouse readiness before launch claims
- **Source basis:** E12.
- **Evidence class:** `frontend_string_inference` plus `oripa_recommendation`.
- **Import stance:** Adopt publish/support controls; gate warehouse depth to launch scope.
- **Copied-risk gate:** No for internal controls; yes for public fulfillment/refund promises.

- **Challenge:** Packs.com’s frontend reveals a large operational backend: inventory update, cycle count, pack/order/ship/refund workflows. Oripa launch quality depends on comparable internal tooling.
- **Action:** Add admin/import/publish validation, support lookup, inventory state management, fulfillment workflow, refund/adjustment actions, and audit events before public promises depend on them.
- **Result:** Operators can resolve real-world edge cases without engineering database edits.
- **Priority:** P0 for publish validation/support lookup; P1 for deeper warehouse workflow unless physical fulfillment is launch-critical.
- **Acceptance:** Admin actions are role/vendor scoped, audited, reversible where policy allows, and protected from cross-tenant access.

### PACKS-CAR-13 — Public API hygiene and error hardening
- **Source basis:** E4, E13.
- **Evidence class:** `direct_public_api` plus `oripa_recommendation`.
- **Import stance:** Adopt now as security/API hardening.
- **Copied-risk gate:** No — this is a defensive control; security claims still need review.

- **Challenge:** Public probes in the evidence ledger indicate possible service-detail exposure and raw database-style error leakage; treat these as defensive API-hardening inputs unless exact captured responses are attached. Oripa should avoid copying that risk.
- **Action:** Hide internal health/service details from public clients; normalize error responses; avoid exposing raw database/model errors.
- **Result:** Public reference surfaces do not become security/support liabilities.
- **Priority:** P0.
- **Acceptance:** Public endpoints return customer-safe error codes/messages; internal health is authenticated; logs retain details privately. Security findings are backed by exact captured public response evidence. Public errors are tested for malformed IDs, bad query params, unauthorized access, hidden products, archived products, and cross-vendor access attempts.

### PACKS-CAR-14 — Wallet, points, deposits, refunds, and balance semantics
- **Source basis:** E1, E2, E12.
- **Evidence class:** Mixed: `direct_public_copy`, `frontend_string_inference`, `account_flow_inference`, and `oripa_recommendation`.
- **Import stance:** Adopt now before paid draws.
- **Copied-risk gate:** Yes — wallet, refund, cashout, bonus, deposit, and dollar-equivalence copy requires legal/payments/support review.
- **Challenge:** Packs.com references Coins, a 1 Coin = $1 claim, deposits, bonus Coins, sell-back, refunds, withdrawals/cashout-like strings, and payment rails. Oripa must not let points behave like money without explicit ledger, legal, refund, and support semantics.
- **Action:** Define Oripa’s launch wallet model before exposing paid openings: paid points, promotional points, bonus points, refunds, admin adjustments, chargebacks, return-to-points, and whether any balance is cash-equivalent or non-cashable.
- **Result:** Wallet copy, draw charges, refunds, and return-to-points behavior remain internally consistent and legally reviewable.
- **Priority:** P0 before paid draws.
- **Acceptance:** Every balance movement writes an immutable ledger event with source, reason, user, vendor, idempotency key, and support ID; UI does not show `1 point = $1`, cashout, withdrawal, refund, or bonus language unless the exact policy and implementation exist.
- **Do not claim:** cash balance, withdrawable value, fixed dollar equivalence, instant refunds, bonus value, or cashout unless fully implemented and approved.

### PACKS-CAR-15 — Eligibility, legal, geo, and age gates
- **Source basis:** E1, E2, E12.
- **Evidence class:** Mixed: `direct_public_copy`, `frontend_string_inference`, `account_flow_inference`, and `oripa_recommendation`.
- **Import stance:** Adopt as a launch safety gate before paid/randomized/value-bearing actions.
- **Copied-risk gate:** Yes — paid randomized prize, fulfillment, region availability, and value-flow copy require explicit policy approval.
- **Challenge:** Paid randomized prize products, return-to-points, cashout-like wording, payment rails, physical fulfillment, and marketplace purchase can trigger legal, age, geo, consumer-protection, tax, AML/KYC, and platform-policy obligations.
- **Action:** Add an eligibility and policy gate before paid opening, return-to-points, fulfillment, marketplace purchase, or any cash-like flow.
- **Result:** Oripa avoids importing a Packs.com-like surface into regions or user states where it cannot legally or operationally support it.
- **Priority:** P0 before paid launch.
- **Acceptance:** Product publish, customer opening, wallet funding, return-to-points, fulfillment, and marketplace actions all check legal/geo/age/vendor eligibility; blocked users see safe copy; support can trace the block reason.
- **Do not claim:** availability, shipping, cashout, sell-back, or marketplace access in unsupported regions.

## Packs.com-derived customer stories for Oripa

### PACKS-STORY-01 — Understand which product mode I am opening

As a customer, I want to know whether I am opening a one-prize pack, multi-slot pack, single pull, demo, or marketplace item so that I understand what result to expect.

Acceptance criteria:

- Product detail shows mode using safe customer language.
- Backend validates product mode before draw/purchase.
- Unsupported modes cannot be published or opened.
- One-prize MVP packs create exactly one user prize record.

### PACKS-STORY-02 — See truthful trust claims on pack detail

As a customer, I want claims like odds, proof, authentic, shipped, sell-back, and value to appear only when supported so that I am not misled.

Acceptance criteria:

- Copy is capability-gated by feature/policy flags.
- Unsupported claims are hidden or replaced with safe copy.
- Admin publish validation blocks high-risk unsupported copy.
- Customer UI never shows marketplace, cashout, shipping automation, or provably-fair wording unless enabled.

### PACKS-STORY-03 — Review odds/chance and value disclosure before opening

As a collector, I want to see price, visible prize pool, chance/odds if supported, rarity, metadata, and reference value source before spending points.

Acceptance criteria:

- Odds/chance come from the same active pool version used by draw transaction.
- Value display includes source/timestamp and safe “reference value” wording.
- Missing or stale values degrade gracefully.
- Draw-time snapshot records customer-visible disclosure.

### PACKS-STORY-04 — Open a paid pack with idempotent draw semantics

As a customer, I want a paid opening to charge me once and create a durable result even if I retry or refresh.

Acceptance criteria:

- Draw requires auth, vendor scope, eligibility check, and idempotency key.
- Wallet debit, prize selection, snapshot/proof record, inventory creation, and audit event commit atomically or with documented compensation.
- Duplicate replay returns the same result or safe conflict.
- Concurrency tests prevent oversold inventory and duplicate debits.

### PACKS-STORY-05 — Verify the draw if proof claims are enabled

As a customer, I want opening history to show enough seed/ticket/snapshot data to verify any “provably fair” claim.

Acceptance criteria:

- If provably fair is enabled, history includes server seed reveal/hash, client seed, nonce, algorithm version, tickets, and range mapping.
- Customer can follow plain-English verification steps.
- If only internal audit is implemented, UI says audit/snapshot record and avoids provably-fair wording.
- Proof/history remains available after archive, return, fulfillment, or support adjustment.

### PACKS-STORY-06 — Keep pulled cards/prizes in my inventory

As a customer, I want pulled prizes to appear in my userPrize inventory so that I can decide what to do later.

Acceptance criteria:

- Successful draws create userPrize records linked to vendor, user, draw order/result, snapshot/proof, and source prize/item.
- Inventory shows image, name, status, source pack, draw time, value where available, and eligible actions.
- Returned/fulfilled/locked/removed states are visible with customer-safe copy.
- Records are not hard-deleted through normal flows.

### PACKS-STORY-07 — Return eligible prizes to points safely

As a customer, I want to preview and confirm returning a prize to points so that I can keep playing without accidental forfeiture or double credit.

Acceptance criteria:

- Story is enabled only if return-to-points is exposed or advertised.
- Preview shows points amount, value basis, and consequence.
- Return is idempotent and writes immutable ledger credit linked to userPrize/draw.
- Fulfillment-pending, fulfilled, locked, removed, returned, stale-value, or non-owned prizes cannot be returned.

### PACKS-STORY-08 — Request shipment/fulfillment only when supported

As a customer, I want to request physical fulfillment only when the operator can actually process it.

Acceptance criteria:

- Fulfillment request is authenticated and scoped to eligible userPrize/vendor/user.
- Starting fulfillment locks return-to-points.
- Address/PII capture is role-gated and audited.
- Region/shipping support is explicit; unsupported regions are blocked or routed to support.
- Copy says admin-assisted fulfillment unless self-serve shipping/tracking is built.

### PACKS-STORY-09 — Track delivery/fulfillment status

As a customer, I want to see fulfillment status updates so that I know what is happening to my physical prize.

Acceptance criteria:

- Statuses are customer-safe, e.g. REQUESTED, NEEDS_INFO, IN_REVIEW, APPROVED, PACKED, SHIPPED, FULFILLED, CANCELLED, REJECTED.
- Tracking/carrier fields appear only if real tracking exists.
- Status changes are audited and support-traceable.
- Returned/voided/refunded fulfillment states cannot conflict with inventory state.

### PACKS-STORY-10 — See opening history and support IDs

As a customer, I want a history of pack openings, results, points movements, and support IDs so that disputes are easy to resolve.

Acceptance criteria:

- History includes draw order/result, wallet ledger link, userPrize link, snapshot/proof link, return/fulfillment state, and timestamp.
- Archived packs and fulfilled/returned prizes remain visible in history.
- Customer can copy a support ID.
- Support lookup can trace the same record internally.

### PACKS-STORY-11 — Browse by game/category and product family

As a collector, I want to browse by game, category, and pack family/tier so that I find relevant packs faster.

Acceptance criteria:

- Game/category/family/tier metadata is vendor scoped.
- Sorts/filters are deterministic and do not imply unsupported profitability or bonus mechanics.
- Disabled/out-of-stock/hidden products cannot be opened.
- Product cards show price and mode clearly.

### PACKS-STORY-12 — Use demo/free opening only without financial side effects

As a prospective customer, I want to try a demo opening so that I understand the experience before spending.

Acceptance criteria:

- Demo opening is clearly labeled demo/free.
- Demo creates no wallet debit and no real prize entitlement unless explicitly implemented as promo with ledger semantics.
- Demo results cannot be confused with owned inventory.
- Anti-abuse controls exist for any promo/free value-bearing flow.

### PACKS-STORY-13 — Buy known cards only through a separate marketplace lane

As a customer, I want known-card purchase to be separate from mystery-pack openings so that I understand when there is no random draw.

Acceptance criteria:

- Marketplace is hidden until end-to-end purchase/fulfillment/refund/support exists.
- Marketplace purchase does not use mystery draw/proof semantics.
- Known-card listing shows actual item, condition, value/price source, and fulfillment terms.
- Marketplace orders are support-traceable separately from draw orders.

### PACKS-STORY-14 — Handle stale or volatile values safely

As a customer, I want value-based actions to be disabled or explained when prices are stale/volatile so that I am not promised an invalid return/fulfillment value.

Acceptance criteria:

- Value has source, timestamp, currency, and volatility/staleness flag.
- Return-to-points and marketplace/fulfillment actions check value eligibility.
- UI explains why action is disabled and gives safe next step.
- Admin/support can override only with reason, role scope, and audit event.

### PACKS-STORY-15 — Show public recent wins only with privacy and reversal safety

As a prospective customer, I want to see recent wins/activity without exposing people or stale/voided records.

Acceptance criteria:

- Public feed is anonymous/masked by default.
- Feed includes only completed, non-reversed draws.
- Voided/refunded/adjusted draws are removed or marked according to policy.
- Support/admin can trace feed item to internal draw record.

### PACKS-STORY-16 — Keep internal errors and health private

As an operator, I want public APIs to return safe errors and hide service internals so that reference/product surfaces do not leak implementation details.

Acceptance criteria:

- Public health does not expose database/cache internals.
- Public API errors use stable customer-safe codes and messages.
- Raw model/database errors are logged privately, not returned to clients.
- Monitoring still captures enough detail for operators.

### PACKS-STORY-17 — Use wallet/points without cashout ambiguity

As a customer, I want my point balance, deposits, bonuses, refunds, and returns to be clearly labeled so that I understand what value I can and cannot redeem.

Acceptance criteria:

- Balance distinguishes paid, promotional, bonus, refunded, and returned points if policies differ.
- UI does not imply cash value, fixed dollar equivalence, withdrawal, or cashout unless implemented and approved.
- Every debit/credit has a ledger event, reason, source object, timestamp, idempotency key, and support ID.
- Refunds, chargebacks, admin adjustments, and return-to-points cannot create duplicate credits.

### PACKS-STORY-18 — Pass eligibility checks before paid randomized openings

As an operator, I want paid openings and value-bearing actions to run only for eligible users and regions so that Oripa does not expose unsupported legal, payment, or fulfillment flows.

Acceptance criteria:

- Paid draw, wallet funding, return-to-points, fulfillment, and marketplace actions check user, vendor, age/terms, region, payment, and product eligibility.
- Blocked users see customer-safe copy.
- Eligibility decisions are logged with support-traceable reason codes.
- Admin publish validation blocks products that are enabled in unsupported regions or with unsupported value claims.

### PACKS-STORY-19 — Publish only validated products and prize pools

As an operator, I want product publishing to validate mode, price, pool, odds, values, inventory, and copy gates so that customers cannot open an unsafe or inconsistent pack.

Acceptance criteria:

- Product cannot be published without mode, price, active pool version, draw algorithm version, disclosure snapshot rules, and supported actions.
- Odds/chance display is blocked unless generated from the transaction pool.
- High-risk copy is blocked unless matching capability and policy gates are enabled.
- Disabled, hidden, archived, out-of-stock, stale-value, or unsupported-region products cannot be opened.

## Integration with the existing reconciled Oripa proposal

Recommended use:

- Treat this file as a candidate fourth reference family only after the evidence ledger, terminology normalization, and CAR/story additions above are preserved.
- Do not replace the existing reconciled proposal directly without another reconciliation pass.
- In the reconciliation pass, import only the following gated deltas:
  1. Explicit product mode model: one-prize pack vs multi-slot pack vs single pull vs marketplace.
  2. Proof tiers: internal audit/snapshot vs public provably-fair verification.
  3. Inventory/userPrize lifecycle and fulfillment statuses.
  4. Value volatility/staleness gates.
  5. Public API hardening: no raw health/service details or DB errors.
  6. Demo/free/promo semantics.
  7. Wallet/points, eligibility, and legal/geo gates for paid randomized prize flows.

Do not import into Oripa MVP without explicit approval:

- Crypto deposits/withdrawals/cashout.
- Marketplace.
- Sell-back as cash or fixed-rate buyback.
- International shipping promises.
- Provably-fair public claims unless the seed/hash/nonce/ticket verifier is implemented.
- Authentic/verified/insured claims unless operations/legal/policy support them.

## Handoff to `@HRMcodingbot`

If implementing Packs.com-derived deltas, ticket in this order:

0. Evidence/terminology prep: add evidence IDs, normalize Oripa terms, and mark each CAR/story with source basis and import stance.
1. Product mode enum, canonical state machines, and publish validation.
2. Wallet/points ledger semantics, idempotency, refunds/adjustments, and no-cashout copy rules.
3. Eligibility/legal/geo/age gates for paid draws, wallet actions, fulfillment, return-to-points, and marketplace.
4. Copy/capability gates for high-risk trust claims.
5. Draw-time odds/chance/value snapshot from the exact transaction pool.
6. Idempotent paid draw transaction: wallet debit, result, snapshot/proof/audit, userPrize, and support ID.
7. Inventory state model and customer opening history.
8. Return-to-points gating with stale/volatile value checks.
9. Fulfillment request/status foundation only if physical prizes are launch scope.
10. Public API error/health hardening and cross-vendor/hidden-product tests.
11. Demo/free/promo semantics.
12. Marketplace only as a separate roadmap lane.
13. Public recent activity feed only after privacy/reversal rules exist.

## Oracle audit trail

- Round 1 Oracle artifact: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/20260529T002908Z_packs-com-reference-car-stories-round1/oracle_response.md` — verdict FAIL; required revisions applied in this version.
- Round 2 Oracle artifact: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/20260529T003711Z_packs-com-reference-car-stories-round2/oracle_response.md` — verdict PASS; no required revisions; optional polish applied.

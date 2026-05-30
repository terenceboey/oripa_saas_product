# Oripa SaaS — Canonical Reconciled CAR + Customer Stories Proposal

Status: **canonical single-source implementation-planning and ticketing proposal** for Oripa SaaS CARs + customer stories. Use this file as the handoff source for `@HRMcodingbot`; treat earlier CAR/story proposal, deep-proposal, reviewed, reference, and source-family files as provenance inputs unless this file explicitly points back to them. Earlier Clove/current-baseline, Phygitals, and Collector Crypt material passed a two-pass Oracle review. Packs.com standalone material also passed a two-pass Oracle review. Final reconciliation hardening applied: source-ID disambiguation, canonical state machines, launch Decision Gate 0, seeded/manual-credit-only funding-copy safety, inventory-before-draw ordering, fulfillment priority consistency, and ticket-ready Packs evidence metadata.

Audience: `@HRMcodingbot`, Oripa SaaS product planning, and implementation ticket shaping.

## Source set and evidence posture

### Reconciled sources

This canonical file reconciles all current CAR / customer-story proposal families found in `docs/`. Earlier files remain useful as evidence/provenance, but they are **not** separate implementation handoffs after this canonical file.

1. **Clove / current Oripa baseline**
   - `docs/reference-clove-pokemon-deep-dive.md`
   - `docs/oripa-saas-car-proposal.md`
   - `docs/oripa-saas-car-proposal-reviewed.md`
   - `docs/oripa-saas-customer-car-deep-research.md`
   - `docs/oripa-saas-customer-stories-proposal.md`
   - `docs/oripa-saas-customer-stories-deep-proposal.md`
   - `docs/oripa-saas-customer-stories-reviewed.md`
2. **Shared core extracted from prior references**
   - `docs/oripa-core-car-and-customer-stories.md`
   - `docs/oripa-saas-phygitals-collectorcrypt-final-proposals.md`
3. **Phygitals**
   - `docs/reference-phygitals-deep-dive.md`
   - `docs/phygitals-car-and-customer-stories-proposal.md`
   - `docs/phygitals-car-and-customer-stories-reviewed.md`
4. **Collector Crypt**
   - `docs/reference-collectorcrypt-deep-dive.md`
   - `docs/collectorcrypt-car-and-customer-stories-proposal.md`
   - `docs/collectorcrypt-car-and-customer-stories-reviewed.md`
   - supplemental public docs: `https://docs.collectorcrypt.com/gacha/api`
5. **Packs.com**
   - `docs/reference-packs-com-deep-dive.md`
   - `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
   - `docs/packs-com-car-and-customer-stories-proposal.md`
   - artifact manifest: `docs/reference-artifacts/packs-com/20260529T070709+0700/manifest.md`
6. **Hypeqiuqiu / customer deep-research artifacts**
   - `docs/oripa-saas-customer-car-deep-research.md`
   - `docs/oripa-saas-customer-stories-deep-proposal.md`
   - `docs/oripa-saas-customer-stories-proposal.md`
   - `docs/oripa-saas-customer-stories-reviewed.md`
   - No separate Hypeqiuqiu-branded filename was found in `docs/`; the Hypeqiuqiu contribution is represented by the customer CAR deep-research and customer-story proposal/review artifacts above.
   - Contribution: customer-facing trust-loop requirements; wallet/draw/inventory/support expectations; story-level acceptance criteria; UX safety boundaries; MVP order from scoped browse/detail through ledger-backed draw, inventory, proof/history, return/fulfillment, and support lookup.

### Oracle review lineage

- Prior Phygitals + Collector Crypt final handoff: `docs/oripa-saas-phygitals-collectorcrypt-final-proposals.md`.
- Prior three-source reconciliation Round 1 required revisions: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/20260528T234845Z_oripa-reconciled-car-stories-round1/oracle_response.md`.
- Prior three-source reconciliation Round 2 verdict: `PASS`, no required revisions: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/manual_oripa_reconciled_round2_retry.md`.
- Packs.com standalone public-reference Round 1 required revisions: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/20260529T002908Z_packs-com-reference-car-stories-round1/oracle_response.md`.
- Packs.com standalone public-reference Round 2 verdict: `PASS`, no required revisions: `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/20260529T003711Z_packs-com-reference-car-stories-round2/oracle_response.md`.
- Four-source consolidated Round 1 Oracle verdict: `REVISE`, artifact `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T010003Z_oripa-four-source-reconciled-round1/oracle_response.md`; blockers addressed: final-review status, launch funding path, and ticket-granular Packs evidence trace.
- Four-source consolidated Round 2 Oracle verdict: `REVISE`, artifact `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T010726Z_oripa-four-source-reconciled-round2/oracle_response.md`; blockers addressed in that revision: stale final-review gate removed, seeded/manual pilot credit locked, and Packs metadata attached directly to consolidated CAR/story sections.
- Final hardening Round 1 Oracle-style verdict: `REVISE`, artifact `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/manual_oripa_four_source_final_round1.md`; blockers addressed in that revision: namespace Packs IDs, explicit state-machine appendix, Decision Gate 0, funding copy cleanup, physical-inventory-before-draw sequencing, and consistent fulfillment priority rule.
- Final hardening Round 2 Oracle-style verdict: `REVISE`, artifact `/home/yeqiuqiu/.hermes/profiles/research/state/oracle_consults/manual_oripa_four_source_final_round2.md`; required revision addressed in this pass: normalize every Packs-derived CAR/story and appendix mapping to the ticket-ready fields `packs_source_file`, `packs_source_basis`, `packs_evidence_ids`, `packs_evidence_class`, and `allowed_interpretation`.

### Evidence rules for this reconciled document

- Treat public reference sites as product-pattern evidence, not as proof that their implementation, legality, payments, shipping, custody, or fairness systems are safe or functional.
- Preserve Packs.com evidence classes when importing Packs-derived deltas:
  - `PUBLIC_API_VERIFIED` / `direct_public_api`
  - `UI_OBSERVED` / `direct_public_copy`
  - `CLIENT_BUNDLE_CLUE` / `frontend_string_inference`
  - `account_flow_inference`
  - `INFERENCE` / `oripa_recommendation`
- Client bundle routes and endpoint strings are domain clues only. They cannot justify MVP scope without UI/API/policy corroboration.
- Randomness proof is not physical-inventory proof. Oripa needs both an auditable random selection record and inventory eligibility/award invariants for physical prizes.
- Any customer-facing claim must be gated by implemented capability, policy approval, and support/operations readiness.

## Executive reconciliation

The four-reference answer is consistent: Oripa SaaS should not be built as only a spin animation. The defensible product is a **vendor-scoped trust loop**:

`vendor-scoped browse/detail → explicit product mode and supported actions → authenticated user/account → one approved funding or seeded-credit path → immutable ledger → centralized eligibility/legal/geo/age gates → idempotent paid draw → atomic result + proof/snapshot + userPrize inventory → history/proof/support trace → return-to-points or admin-assisted fulfillment only when enabled → audited operations and public-surface hygiene`

The reconciled MVP should prioritize correctness and claim safety before merchandising:

1. **Tenant, user, wallet, and eligibility safety** — user/vendor scoping, immutable ledger, idempotency, legal/geo/age and supported-action gates, and one selected launch funding path.
2. **Product-mode clarity** — define `one_prize_pack`, `single_pull`, `multi_slot_pack`, `marketplace_purchase`, and `demo_opening` semantics before coding draw variants.
3. **Atomic draw + inventory** — every paid draw produces exactly the ledger/result/proof/snapshot/userPrize records it claims, or rolls back/compensates safely.
4. **Proof and disclosure boundaries** — immutable draw-time snapshot now; public “provably fair” only after seed/hash/nonce/ticket verifier, test vectors, and security review exist.
5. **Physical prize lifecycle** — userPrize state machine, item eligibility, return-to-points, and admin-assisted fulfillment cannot conflict.
6. **Admin and API hygiene** — publish validation, support trace, inventory allocation/discrepancy controls, safe public DTOs/errors, and no raw internal health/database leakage.
7. **Merchandising after trust** — categories, family/tier ladders, value bands, featured possible pulls, risk labels, recent winners, demo openings, vouchers, marketplace, and growth loops must follow the foundation.

Do **not** launch marketing claims for vaulting, insurance, authentication/scanning, public VRF/provably-fair verification, worldwide/self-serve shipping, cash buyback, cashout/withdrawal, fixed point-dollar equivalence, multiple payment rails, marketplace trading/purchase, rank progression, RUSH/last-one/round-number/extra bonuses, free packs, or daily packs until those capabilities are built, policy-approved, and verified.

## Source contribution map

### Clove / current Oripa baseline contributes

- Category/tag/sort storefront discovery.
- Prize-grade lineups and collector metadata.
- Pack availability, release windows, draw limits, and basic eligibility.
- Wallet-backed draw loop, draw audit/proof record, proof lookup, and support trace.
- Admin/import workflow and safe publish validation.
- Current code reality: wallet scoping and customer wallet readiness require explicit verification/fix before customer wallet claims.

### Phygitals contributes

- Category-led discovery across collectible categories.
- Pack family/tier ladders and risk/spice variants.
- Value-band and EV-like merchandising, but only under approved value/EV policy.
- Featured possible pulls / top-hit showcase with availability-safe copy.
- Demo spin as later onboarding mechanic.
- Regret-reduction pattern translated to Oripa as return-to-points only when inventory + ledger + value policy exist.

### Collector Crypt contributes

- Durable prize entitlement / custody-style lifecycle.
- Structured collectible metadata and reference-value policy.
- Pack machine status and emergency stop semantics.
- Recent/all-winners feeds as privacy-sensitive trust signals.
- Buyback/auto-sell/open-later/promo patterns as roadmap, not MVP.
- Future identity/marketplace vocabulary without forcing web3 into MVP.

### Packs.com contributes

- Strongest full-loop reference: pack/single-pull/marketplace lanes, wallet-backed openings, inventory/backpack, return/sell-back, fulfillment, opening history, recent stats/public activity projection patterns, and fairness proof claims.
- Explicit product taxonomy and mode separation: pack-style openings, one-card pulls/cases, marketplace singles, demo openings.
- Draw-table evidence: public item chance and ticket interval disclosure in sampled APIs.
- Fairness proof design pattern: server seed hash, client seed, nonce/opening count, deterministic ticket derivation, and verification UX.
- Admin/warehouse clues: intake batches, unallocated stock, pool allocation, pending fulfillment, shipments, cycle counts, and discrepancy locks.
- Public API hygiene warning: use allowlisted customer DTOs, customer-safe errors, private internal health, and tests for malformed IDs, hidden products, and cross-vendor access.
- Wallet/copy warning: Coins, 1 Coin = $1, deposits, bonus/refund/cashout/withdrawal strings, and multi-rail hints must not be copied without Oripa’s policy and implementation.

## Source-to-capability trace

- **Authenticated vendor/user scoping:** Clove/current baseline direct; Phygitals/Collector/Packs indirect; shared core `CORE-CAR-01`.
- **Immutable wallet ledger/idempotency:** Clove/current baseline direct; all references strengthen; shared core `CORE-CAR-15`; Packs wallet semantics and copy warnings.
- **Exactly one launch funding path:** Clove/core requirement; Packs warns against importing multi-rail/cashout copy.
- **Legal/geo/age/value eligibility gates:** Packs strengthens; required for paid randomized/value-bearing/fulfillment/marketplace actions.
- **Canonical product mode enum:** Packs direct; Phygitals/Collector indirect through demo/open-later/marketplace/voucher patterns.
- **Atomic paid draw:** Clove/core direct; Packs direct; shared core `CORE-CAR-02/16`.
- **Draw-time snapshot/proof record:** all references strengthen; Packs adds ticket intervals and seed/hash/nonce verifier boundary.
- **Durable prize entitlement inventory:** Clove/core direct; Collector/Packs direct; Phygitals strengthens regret reduction and value display.
- **Category/family/tier discovery:** Clove/Phygitals/Packs direct; Collector indirect through pack codes/status.
- **Value/reference metadata:** Phygitals/Collector/Packs direct; must be reference value unless insurance/custody exists.
- **Odds/chance only from transaction pool:** Packs direct; Phygitals value-band support; core snapshot requirement.
- **Return-to-points:** Phygitals/Collector/Packs all strengthen; not cash buyback/cashout.
- **Admin-assisted fulfillment:** Clove/core required if physical prizes promised; Collector/Packs strengthen custody/shipping/ops requirements.
- **Public recent winners/projections:** Collector/Packs direct; Phygitals supports; privacy/reversal/support trace required.
- **Admin inventory intake/allocation/reconciliation:** Packs frontend/admin-route clues; Collector strengthens physical item state.
- **Public API hygiene and defensive errors:** Packs direct; required P0 hardening.
- **Web3/marketplace/loans/trading/cashout:** roadmap/non-goal unless explicitly re-scoped and implemented.

## Reconciled implementation priority

### P0 — launch-safety blockers

1. **User/vendor scoping:** authenticated customer identity and vendor scope for wallet, draw, history/audit, inventory, return, fulfillment, support, admin, and public projection internals.
2. **Wallet ledger:** immutable ledger with idempotent credits/debits/returns/refunds/chargebacks/admin adjustments; non-negative balance; paid/promotional/bonus/refunded/returned point policy; no cashout/fixed-dollar copy unless approved.
3. **Launch funding path:** MVP assumes seeded/manual pilot credit only. Public funding UX is not a payment checkout. Do not create Stripe/payment-provider tickets, show “buy points” copy, or expose multi-rail, crypto, cashout, withdrawal, refund, bonus, or fixed dollar-equivalence copy until product explicitly replaces this assumption with an approved provider scope.
4. **Central eligibility service:** status, stock, time windows, user limits, auth, vendor scope, emergency stop, legal/geo/age, payment, product mode, region, and supported-action reason codes used by list/detail/draw/wallet funding/return/fulfillment/marketplace paths.
5. **Canonical product mode/state model:** `one_prize_pack` MVP; `single_pull` either collapses into one-prize or is explicitly justified; `multi_slot_pack` disabled until multi-award records/snapshots exist; `marketplace_purchase` roadmap; `demo_opening` non-value-bearing unless promo-ledger semantics exist.
6. **Atomic paid draw transaction:** eligibility re-check, wallet debit, prize selection/reservation/award, draw order/result, proof/snapshot, userPrize, audit/outbox, and idempotency in one committed unit or documented safe compensation.
7. **Draw-time snapshots:** pack version, price, customer-visible disclosure, pool/config, odds/chance/value bands if shown, policy versions, algorithm version, and supported-actions policy at draw time.
8. **Pack operational status and emergency stop:** draft, active, paused, out-of-stock, archived; emergency stop is audited and blocks new draws regardless of lifecycle status.
9. **Admin/import/publish validation:** minimal pack creation plus field-specific validation for vendor scope, product mode, price, stock, active pool, weights/ticket intervals, metadata, images, proof/snapshot, policy links, eligibility/support actions, and high-risk copy.
10. **Physical item eligibility states:** unavailable/hidden/removed/locked/reserved/awarded/returned/fulfilled/wrong-vendor/excluded/stale-value items cannot enter active pools; awarded physical items cannot be awarded twice.
11. **UserPrize inventory:** every successful MVP paid draw creates exactly one durable userPrize record; multi-slot remains disabled until multiple explicit records are modeled.
12. **Proof/history boundary:** if any “fair,” “verified,” “proof,” or “provably fair” copy is used, provide a customer-safe audit/snapshot page that states exactly what it proves. Public provably-fair wording requires reproducible verifier inputs.
13. **Support trace:** scoped lookup connecting wallet ledger, draw order/result, proof/snapshot, userPrize, return, fulfillment, audit/outbox, and public projection where applicable.
14. **Public API hygiene:** public endpoints use allowlisted DTOs and stable customer-safe errors; internal health is authenticated; tests cover malformed IDs, bad params, unauthorized access, hidden/archived products, and cross-vendor/user attempts.
15. **Policy version capture:** product publish and draw receipt must capture applicable terms, refund/return, fulfillment, fairness/proof, privacy/feed, and claim policy versions; no silent cross-tenant/default policy fallback.

### P1 — near-MVP trust and usability

1. Category/game/tag browse and deterministic safe filters/sorts.
2. Pack family/tier navigation and memorable vendor-scoped code/slug.
3. Pack detail view model: mode, price, status, supported actions, visible prize groups, featured possible pulls, minimal metadata, disclosure/proof summary, and unavailable reason.
4. Structured collectible metadata: image, name, game/category, set/year/card number, certifier, grade, cert number, condition, reference value/source/timestamp.
5. Value/reference policy: reference value, not insured value; stale/volatile values hide or block value-dependent actions.
6. Return-to-points only if advertised: preview, confirmation, idempotent ledger credit, userPrize state transition, stale-value guard, and return/fulfillment mutual exclusion.
7. Admin-assisted fulfillment foundation if launch creates physical prize entitlements: authenticated request, address/PII controls, region handling, lock semantics, status workflow, exception paths, and support trace. If this is not implemented, UI/copy must not imply shipment, redemption, delivery, or physical claim.
8. Opening/transaction/prize/fulfillment history surfaces over core records, not alternate sources of truth.
9. Policy/help/fairness/support links on decision surfaces with draw-time policy version capture.
10. Claim/copy validation for EV, live odds, buyback, owned, vaulted, insured, authenticated, shipped, provably fair, fair odds, 1 point = $1, cashout, marketplace, and worldwide shipping.

### P2 — growth after trust foundation

1. Value-band odds and EV display backed by snapshot freshness, approved computation/policy, and publish validation.
2. Risk/spice variants and qualitative risk labels only with approved source/freshness and no profit implication.
3. Demo-only opening mode with separate demo namespace, rate limits, and no wallet/inventory/fulfillment/feed side effects.
4. Public recent winners/public activity projection only after privacy, reversal/void policy, support trace, rate limits, and allowlisted DTOs.
5. Intake batch UI, unallocated stock queue, pending fulfillment queue, basic cycle-count discrepancy workflow.
6. Promo credits/free spins/vouchers/open-later only after anti-abuse, eligibility, ledger/source, and support semantics exist.
7. Advanced account/security/address lifecycle if fulfillment/payment scope requires it.

### P3 / roadmap, not MVP claims

- Marketplace/listing/trading/peer transfer / known-card purchase lane.
- Self-serve shipping automation with address book, fees, labels, carrier integrations, tracking, and exception automation.
- Web3/NFT/Solana/Coinflow/Moonpay/Privy identity/payment flows.
- Cash, stablecoin, crypto, or external-money cashout/buyback/withdrawal.
- Collateralized loans.
- Leaderboards, referrals, affiliates, rank progression, RUSH tickets, last-one/round-number/extra threshold bonuses, daily/free packs, and advanced campaigns.


## Decision Gate 0 — pre-ticket launch assumptions and decision tickets

Before `@HRMcodingbot` creates implementation tickets, resolve or explicitly ticket these launch decisions. Default MVP assumptions below are safe fallbacks; changing any one creates a separate product/engineering/legal decision ticket before feature tickets.

1. **Funding path:** default MVP is seeded/manual pilot credit only. No payment checkout, deposits, buy-points copy, bonus-value copy, fixed point-dollar equivalence, cashout, or withdrawal.
2. **Physical prize promise / fulfillment scope:** if launch creates physical prize entitlements, minimum admin-assisted fulfillment policy/state/support path is P0. If not implemented, hide shipment, redemption, delivery, physical-claim, and fulfillment-request copy/actions.
3. **Proof tier:** default MVP is internal audit/snapshot record. Public provably-fair proof requires seed/hash/nonce/ticket verifier inputs, test vectors, seed lifecycle, and security review before customer claims.
4. **Return-to-points launch scope:** default hidden unless advertised. If exposed, return-to-points requires inventory state, ledger credit, value policy, idempotency, and fulfillment mutual exclusion.
5. **Odds disclosure level:** exact odds/ticket intervals require transaction-pool-backed snapshot and publish validation. If not ready, show only safer prize-lineup/disclosure copy.
6. **Policy/version storage:** choose versioned policy records or immutable draw policy snapshots; product publish/draw must fail on missing/wrong-vendor/expired policy.
7. **`single_pull` vs `one_prize_pack`:** default collapse `single_pull` into `one_prize_pack` unless product/legal/UX explicitly needs a distinct mode.

## Reconciled CAR proposal

### CAR-01 — Scoped customer and tenant safety

- **Challenge:** Multi-tenant Oripa data can leak or corrupt customer state if routes are only vendor-scoped, unauthenticated, or inconsistent.
- **Action:** Enforce authenticated user + vendor scope for wallet, draw, inventory, audit/snapshot, return, fulfillment, support, and role/vendor scope for admin/support.
- **Result:** Customers see only their own financial/prize records and vendors remain isolated.
- **Priority:** P0.
- **Acceptance:** Cross-user and cross-vendor attempts fail for wallet, draw history, inventory, audit/snapshot, return, fulfillment, support, public projection management, and admin routes.
- **Copy-safe claim:** “Customer wallet, draw, and prize records are account-scoped.”
- **Do not claim yet:** broad security/compliance certifications unless audited.

### CAR-02 — Immutable wallet ledger and one funding path

- **Challenge:** Customers cannot trust points if balances are mutable, untraceable, or funded through hidden manual steps.
- **Action:** Use immutable ledger entries for credits, debits, returns, refunds, chargebacks, and admin adjustments. MVP funding is seeded/manual pilot credit only; separate paid/promotional/bonus/refunded/returned points if policy differs. Payment-provider purchase flows are out of scope until explicitly approved.
- **Result:** Every balance movement is supportable and duplicate-safe.
- **Priority:** P0.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-14 / packs_reverse.PACKS-STORY-17; packs_evidence_ids=packs_reverse.PACKS-CAR-14 / packs_reverse.PACKS-STORY-17; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=wallet/ledger/copy boundaries only; import_stance=adopt wallet/ledger/copy boundaries, exclude deposits/cashout/fixed dollar equivalence; copied_risk_gate=yes.
- **Acceptance:** Balance cannot go negative; duplicate debit/credit/return/refund/chargeback/adjustment requests are idempotent or conflict safely; MVP funding copy says seeded/admin pilot credits, not “buy points”; UI does not show `1 point = $1`, cashout, withdrawal, bonus-value, refund, Stripe/payment checkout, or multi-rail language unless policy and implementation exist.
- **Copy-safe claim:** “Every points movement is recorded in a traceable ledger.”
- **Do not claim yet:** multiple payment methods, cashout/withdrawal, fixed point-dollar equivalence, instant refunds, bonus value, or crypto rails.

### CAR-03 — Central eligibility and availability truth

- **Challenge:** Trust drops when list/detail says a product is open but checkout/draw rejects it.
- **Action:** Centralize availability/eligibility checks for status, stock, timing, auth, user limits, vendor scope, emergency stop, legal/geo/age/payment/product eligibility, and supported actions.
- **Result:** Customers know whether they can draw before attempting payment/open.
- **Priority:** P0.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-15 / packs_reverse.PACKS-STORY-18; packs_evidence_ids=packs_reverse.PACKS-CAR-15 / packs_reverse.PACKS-STORY-18; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=eligibility/supported-action gates only; import_stance=adopt paid/value/fulfillment eligibility gate; copied_risk_gate=yes.
- **Acceptance:** List, detail, wallet funding, draw, return-to-points, fulfillment, and marketplace paths use shared reason vocabulary where applicable; draw re-checks state inside the transaction; blocked users see safe copy and support can trace the reason.
- **Copy-safe claim:** “Unavailable products are disabled with a clear reason.”
- **Do not claim yet:** availability in unsupported regions, shipping where unsupported, rank/daily/new-user mechanics, or advanced gates unless implemented.

### CAR-04 — Canonical product mode and state model

- **Challenge:** References separate pack openings, single pulls/cases, marketplace purchases, demo openings, and open-later/voucher flows. A generic `Pack` model will blur draw semantics and customer expectations.
- **Action:** Define `product_mode`: `one_prize_pack`, `single_pull`, `multi_slot_pack`, `marketplace_purchase`, `demo_opening`; optionally future `pack_voucher`/`promo_opening` if approved. Product mode controls disclosure, draw logic, proof/snapshot shape, inventory creation, and supported actions.
- **Result:** Product detail, draw API, proof, inventory, fulfillment, and history agree on what the customer bought/opened.
- **Priority:** P0 for enum/state boundaries; P1/P2 for non-MVP modes.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-02 / packs_reverse.PACKS-STORY-01; packs_evidence_ids=packs_reverse.PACKS-CAR-02 / packs_reverse.PACKS-STORY-01; packs_evidence_class=direct_public_copy+direct_public_api+frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt enum boundaries, gate non-MVP modes; import_stance=adopt enum boundaries, gate non-MVP modes; copied_risk_gate=customer-facing mode claims only.
- **Acceptance:** Each active product has exactly one mode; unsupported modes cannot be published or opened; MVP one-prize mode creates exactly one userPrize; multi-slot cannot be enabled until multiple slot snapshots and multiple userPrize records are implemented; marketplace/demo do not borrow mystery-draw proof semantics unless explicitly implemented.
- **Copy-safe claim:** “Each product clearly states what kind of opening it supports.”
- **Do not claim yet:** marketplace purchase, multi-card opening, demo prizes, or voucher/open-later value until exact mode exists end to end.

### CAR-05 — Atomic paid draw transaction

- **Challenge:** Retries, concurrency, or partial failures can double-charge customers, oversell prizes, or produce untraceable results.
- **Action:** Execute paid draw as one idempotent transaction: eligibility check, product-mode validation, wallet debit, prize selection/reservation, draw order/result, proof/snapshot, userPrize inventory, audit/outbox.
- **Result:** Customers never lose points without a durable, traceable outcome.
- **Priority:** P0.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-STORY-04 plus packs_reverse.PACKS-CAR-03/05/10/14; packs_evidence_ids=packs_reverse.PACKS-STORY-04 plus packs_reverse.PACKS-CAR-03/05/10/14; packs_evidence_class=direct_public_api+oripa_recommendation; allowed_interpretation=adopt transaction/idempotency constraints; import_stance=adopt transaction/idempotency constraints; copied_risk_gate=yes for paid draw/points/result/fairness copy.
- **Acceptance:** Idempotency key is required; exact replay returns same result or safe conflict; failures roll back or create documented compensation; concurrency tests prevent negative balance, oversold stock, duplicate physical item awards, and duplicate debits.
- **Copy-safe claim:** “Draw requests are designed to be retry-safe and duplicate-charge resistant.”
- **Do not claim yet:** perfect concurrency guarantees before tests prove them.

### CAR-06 — Draw-time snapshot, odds/ticket disclosure, and proof boundary

- **Challenge:** Disputes cannot be resolved if odds, ticket tables, values, policy, copy, or proof inputs mutate after purchase.
- **Action:** Record product version, prize pool/config snapshot, customer-visible disclosure copy, odds/chance/ticket intervals or value bands if shown, return/fulfillment/proof/privacy policy versions, algorithm version, and customer-safe proof material per paid draw.
- **Result:** Customers/support can inspect what applied at draw time.
- **Priority:** P0 for draw-time disclosure/config snapshot on paid draws; exact odds/ticket table is P0 if exact odds are displayed; public proof page is P0 if proof/fairness copy is used.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-03/04/10 and packs_reverse.PACKS-STORY-03/05/10; packs_evidence_ids=packs_reverse.PACKS-CAR-03/04/10 and packs_reverse.PACKS-STORY-03/05/10; packs_evidence_class=direct_public_api+direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt snapshot boundary, gate public verifier; import_stance=adopt snapshot boundary, gate public verifier; copied_risk_gate=yes.
- **Acceptance:** Ticket intervals, if shown, are contiguous/non-overlapping and cover the denominator; stale client odds/tickets are ignored; proof page says exactly what it proves. Public “provably fair” requires pre-commitment hash, client seed, nonce/opening index, algorithm version, deterministic ticket mapping, seed reveal/rotation, test vectors, plain-English verifier instructions, and security review.
- **Copy-safe claim:** “Each paid draw keeps a audit/snapshot record for the configuration used at purchase time.”
- **Do not claim yet:** public VRF, live odds, fair odds, verified draw, or provably fair unless implemented exactly.

### CAR-07 — Durable prize entitlement inventory

- **Challenge:** A reveal animation is not enough; customers need a durable record of what they won and what actions are available.
- **Action:** Create a userPrize record for every successful paid draw, linked to vendor, user, draw order/result, proof/snapshot, source prize/item, state, metadata, and available actions.
- **Result:** Customers can revisit, return, fulfill, or get support for won prizes.
- **Priority:** P0.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-05 / packs_reverse.PACKS-STORY-06; packs_evidence_ids=packs_reverse.PACKS-CAR-05 / packs_reverse.PACKS-STORY-06; packs_evidence_class=direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt userPrize inventory now; import_stance=adopt userPrize inventory now; copied_risk_gate=yes for ownership/fulfillment copy.
- **Acceptance:** MVP `one_prize_pack` draws create exactly one userPrize record. Awarded inventory cannot be awarded again. Customer projection may use “inventory” or “backpack” language but source of truth remains userPrize/prize entitlement. Records are not hard-deleted in normal flows.
- **Copy-safe claim:** “Wins become durable prize records in your account.”
- **Do not claim yet:** legal title/ownership beyond approved terms.

### CAR-08 — Physical inventory eligibility, allocation, and discrepancy controls

- **Challenge:** Physical-prize odds and fulfillment are untrustworthy if stock is unallocated, missing, excluded, reserved, stale, or wrong-vendor.
- **Action:** Model item eligibility states, intake/allocation to pools, exclusions/banned items, discrepancy locks, and audit events. Add intake batch / unallocated stock / cycle-count concepts at least enough to block unsafe publish/draw/fulfillment.
- **Result:** Customer-facing pools and fulfillment promises stay tied to real eligible stock.
- **Priority:** P0 for item eligibility, allocation-to-pool validation, discrepancy lock, and audit; P1/P2 for full warehouse UI.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-12; packs_evidence_ids=packs_reverse.PACKS-CAR-12; packs_evidence_class=frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt publish/support controls, gate warehouse depth; import_stance=adopt publish/support controls, gate warehouse depth; copied_risk_gate=yes for fulfillment/refund/warehouse automation promises.
- **Acceptance:** Items cannot enter live pools until allocated and eligible; publish fails if rows reference unallocated, locked, reserved, awarded, returned, fulfilled, removed, wrong-vendor, excluded, stale-price, or discrepancy-locked items; missing/wrong-condition discrepancies lock item and pause affected product where policy requires.
- **Copy-safe claim:** “Prize pools are validated against eligible inventory before publish.”
- **Do not claim yet:** warehouse automation, insured custody, or guaranteed physical availability beyond implemented controls.

### CAR-09 — Safe pack disclosure and prize metadata

- **Challenge:** Collectors need enough detail to evaluate products without being misled by unsupported odds/value/availability claims.
- **Action:** Show product mode, price, remaining stock/status where supported, visible prize groups, featured possible pulls, odds/chance only from transaction pool if shown, structured metadata, reference value/source/timestamp, and supported disclosure policy.
- **Result:** Customers can judge product quality before spending.
- **Priority:** P0/P1.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-03/09 and packs_reverse.PACKS-STORY-03/14; packs_evidence_ids=packs_reverse.PACKS-CAR-03/09 and packs_reverse.PACKS-STORY-03/14; packs_evidence_class=direct_public_api+frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt transaction-pool odds and stale/volatile value gates; import_stance=adopt transaction-pool odds and stale/volatile value gates; copied_risk_gate=yes.
- **Acceptance:** Missing metadata degrades gracefully; top-hit copy says “featured possible pulls” unless availability is guaranteed; reference values are labeled and stale/volatile values hide value-dependent actions; odds/chance display is blocked if pool data is incomplete/stale or not transaction-backed.
- **Copy-safe claim:** “Review product price, availability, and prize lineup before drawing.”
- **Do not claim yet:** “top items available,” “authentic,” “insured,” “scanned,” “vaulted,” or “EV/live odds” unless backed.

### CAR-10 — Category, tag, sort, family, tier, and code discovery

- **Challenge:** A flat product list is weak for collectors with specific interests, budgets, franchises, and risk preferences.
- **Action:** Add vendor-scoped categories, safe tags, deterministic sorts, pack family/tier metadata, related-product navigation, and memorable product codes/slugs.
- **Result:** Customers find relevant products faster and support can discuss products with stable references.
- **Priority:** P1 after P0 safety.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-STORY-11; packs_evidence_ids=packs_reverse.PACKS-STORY-11; packs_evidence_class=direct_public_copy+direct_public_api+frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt safe browse metadata after P0; import_stance=adopt safe browse metadata after P0; copied_risk_gate=yes for unsupported mode/profit/category claims.
- **Acceptance:** Categories/tags/families/tiers/codes are vendor-scoped; risky tags are blocked unless mechanics exist; disabled/out-of-stock tiers cannot be opened; product code/slug uniqueness is vendor-scoped and display-safe.
- **Copy-safe claim:** “Browse products by game, category, and collector intent.”
- **Do not claim yet:** profit/rank/bonus/RUSH tags without mechanics.

### CAR-11 — Return-to-points without double-credit risk

- **Challenge:** Customers want liquidity for unwanted wins, but returns can corrupt balances if state, value, and ledger are not locked together.
- **Action:** Implement explicit eligibility policy, value freshness/staleness rules, preview, confirmation, idempotent ledger credit, and userPrize state transition.
- **Result:** Eligible prizes can be converted safely and supportably.
- **Priority:** P0/P1 if advertised; hide otherwise.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-06 / packs_reverse.PACKS-STORY-07; packs_evidence_ids=packs_reverse.PACKS-CAR-06 / packs_reverse.PACKS-STORY-07; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=gate unless launch feature; import_stance=gate unless launch feature; copied_risk_gate=yes.
- **Acceptance:** Duplicate return cannot double-credit; returned prize cannot be fulfilled or returned again; ledger links to userPrize and draw order; return amount derives from documented policy; paid/promotional credits follow wallet policy; fulfillment-pending/fulfilled/locked/non-owned/stale-value prizes cannot be returned; return is irreversible unless an explicit admin reversal flow exists.
- **Copy-safe claim:** “Eligible prizes can be returned to points.”
- **Do not claim yet:** cash buyback, fixed buyback %, instant sellback, cashout, withdrawal, or auto-sell unless built.

### CAR-12 — Fulfillment foundation without shipping overclaim

- **Challenge:** Physical prizes require PII handling, eligibility, region rules, locking, status workflow, exception handling, and support before shipping automation can be promised.
- **Action:** Add admin-assisted fulfillment request lifecycle and custody/fulfillment metadata before self-serve shipping.
- **Result:** Operators can fulfill physical prizes operationally while avoiding fake automation claims.
- **Priority:** P0 if launch creates physical prize entitlements; otherwise hide shipment/redemption/delivery/physical-claim copy and keep fulfillment disabled.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-07 / packs_reverse.PACKS-STORY-08/09; packs_evidence_ids=packs_reverse.PACKS-CAR-07 / packs_reverse.PACKS-STORY-08/09; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=gate unless physical fulfillment is launch scope; import_stance=gate unless physical fulfillment is launch scope; copied_risk_gate=yes.
- **Acceptance:** Fulfillment request is authenticated and scoped to eligible userPrize; starting fulfillment locks return-to-points; PII is role-gated and audited; unsupported regions are blocked or routed to support; fulfillment state is separate from userPrize state but cannot conflict; lost/damaged/replacement/cancellation/refund/support-adjustment paths are defined before public shipping promises.
- **Copy-safe claim:** “Eligible physical prizes can be handled through support/admin-assisted fulfillment.”
- **Do not claim yet:** worldwide shipping, tracked delivery, insured vaulting, self-serve shipping, instant delivery, or guaranteed fulfillment timing.

### CAR-13 — Support trace and operational auditability

- **Challenge:** Support cannot resolve disputes if wallet, draw, proof, prize, return, fulfillment, public feed, policy versions, and admin actions are disconnected.
- **Action:** Provide scoped lookup across ledger entry, draw order/result, proof/snapshot, userPrize, return/fulfillment status, public projection, policy versions, audit events, and outbox.
- **Result:** Disputes are resolved without engineering database spelunking.
- **Priority:** P0.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-10/12 / packs_reverse.PACKS-STORY-10; packs_evidence_ids=packs_reverse.PACKS-CAR-10/12 / packs_reverse.PACKS-STORY-10; packs_evidence_class=direct_public_copy+direct_public_api+frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt history/support record, gate proof fields; import_stance=adopt history/support record, gate proof fields; copied_risk_gate=yes.
- **Acceptance:** Lookup supports user ID, draw/order ID, proof ID, wallet entry ID, userPrize ID, fulfillment/return ID, and public feed/projection ID where applicable; role/vendor scoped; audited; PII/security internals redacted by role.
- **Copy-safe claim:** “Support can trace each draw from points movement to prize record.”
- **Do not claim yet:** realtime monitoring/alerts unless built.

### CAR-14 — Privacy-safe public proof/social signals

- **Challenge:** Recent winner/public-activity projections build trust but can leak identity, active seed/security internals, internal inventory IDs, or stale/voided events.
- **Action:** Publish optional masked projections only for completed, eligible, non-reversed draws, through allowlisted DTOs with hide/void support and internal trace.
- **Result:** Storefront can look active without exposing users or freezing false history.
- **Priority:** P2 unless already part of launch scope.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-11 / packs_reverse.PACKS-STORY-15; packs_evidence_ids=packs_reverse.PACKS-CAR-11 / packs_reverse.PACKS-STORY-15; packs_evidence_class=direct_public_api+oripa_recommendation; allowed_interpretation=P2 roadmap; import_stance=P2 roadmap; copied_risk_gate=yes for privacy/reversal policy.
- **Acceptance:** Feed is anonymous by default; consent governs identifiable display; demo/test/private/hidden/refunded/voided/disputed draws are excluded or marked by policy; projection has public ID, not internal raw IDs; endpoint is rate-limited.
- **Copy-safe claim:** “Recent wins can be shown anonymously after privacy controls are enabled.”
- **Do not claim yet:** recent winners/public activity projection before reversal/privacy/support behavior exists.

### CAR-15 — Claim-safety policy and copy gates

- **Challenge:** Words like EV, live odds, fair/provably fair, buyback, owned, vaulted, insured, authenticated, shipped, 1 point = $1, marketplace, cashout, and worldwide shipping create trust/legal risk.
- **Action:** Add claim categories and publish-time copy validation tied to implemented capabilities, policy versions, and feature flags.
- **Result:** Customer-facing copy stays aligned with real product behavior.
- **Priority:** P0/P1.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-01/08/14/15; packs_evidence_ids=packs_reverse.PACKS-CAR-01/08/14/15; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=adopt gates, hide marketplace/cashout/automation; import_stance=adopt gates, hide marketplace/cashout/automation; copied_risk_gate=yes.
- **Acceptance:** Admin cannot publish unsupported regulated/high-risk claims; validation suggests safer copy; customer UI hides unsupported buttons, tags, badges, and API affordances.
- **Copy-safe claim:** “Copy is validated against enabled product capabilities.”
- **Do not claim yet:** any roadmap/non-goal claim.

### CAR-16 — Customer history surfaces over source-of-truth records

- **Challenge:** Customers need opening, transaction, prize, and fulfillment history without duplicating mutable sources of truth.
- **Action:** Build history views from draw results, wallet ledger, userPrize records, fulfillment requests, return events, and proof/snapshot records.
- **Result:** Customers self-serve basic questions while support sees the same trace internally.
- **Priority:** P1; P0 for minimum paid draw/wallet/userPrize history if public paid launch.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-10 / packs_reverse.PACKS-STORY-10; packs_evidence_ids=packs_reverse.PACKS-CAR-10 / packs_reverse.PACKS-STORY-10; packs_evidence_class=direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt history over source records; import_stance=adopt history over source records; copied_risk_gate=yes for verification/proof claims.
- **Acceptance:** Histories cannot expose other users, admin notes, raw seeds, internal IDs, PII, or warehouse notes; failed/rolled-back draws are not shown as successful; archived packs and returned/fulfilled prizes remain visible with safe status.
- **Copy-safe claim:** “Review your opening history and points movements.”
- **Do not claim yet:** downloadable tax/compliance statements unless implemented.

### CAR-17 — Demo, promo, voucher, and open-later gates

- **Challenge:** Demo/free/open-later flows help conversion but can break ledger/inventory semantics if treated like normal paid draws.
- **Action:** Keep demo openings non-value-bearing and isolated; treat real promo/free/voucher/open-later as separate modes requiring eligibility, anti-abuse, ledger/source records, expiration/cancellation, and support trace.
- **Result:** Growth loops can be added without corrupting paid draw and inventory records.
- **Priority:** P2/Roadmap unless explicitly scoped.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-STORY-12 plus product-mode clues; packs_evidence_ids=packs_reverse.PACKS-STORY-12 plus product-mode clues; packs_evidence_class=direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=demo non-value roadmap, promo/voucher gated; import_stance=demo non-value roadmap, promo/voucher gated; copied_risk_gate=yes.
- **Acceptance:** Demo creates no wallet, real proof, userPrize, fulfillment, or public feed record; promo/free value-bearing flows have source ledger and anti-abuse controls; vouchers cannot be opened if expired/cancelled/opened and opening is atomic.
- **Copy-safe claim:** “Demo openings are non-redeemable.”
- **Do not claim yet:** free packs, daily rewards, vouchers, or gift packs unless built.

### CAR-18 — Future-proofing without roadmap leakage

- **Challenge:** Marketplace, trading, transfers, linked identities, web3-like ownership, and cashout may be useful later but should not distort MVP or appear in customer UI.
- **Action:** Reserve data-model vocabulary where cheap, keep User as canonical owner, and hide unsupported UI/actions/routes/copy.
- **Result:** Oripa can evolve without misleading customers or orphaning records.
- **Priority:** Design constraint / P2+.
- **Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-08 / packs_reverse.PACKS-STORY-13; packs_evidence_ids=packs_reverse.PACKS-CAR-08 / packs_reverse.PACKS-STORY-13; packs_evidence_class=direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=roadmap only; import_stance=roadmap only; copied_risk_gate=yes.
- **Acceptance:** Unsupported marketplace/trade/transfer/free-pack/voucher/cashout/web3 actions do not appear in customer UI; backend rejects unsupported actions server-side; future statuses do not leak as customer actions.
- **Copy-safe claim:** “The data model leaves room for future prize lifecycle features.”
- **Do not claim yet:** marketplace, transfer, web3, NFTs, cashout, free packs, vouchers, peer trading, or loans.

## Reconciled customer stories

### STORY-01 — Enforce scoped sensitive reads and writes

As a customer, I want my wallet, draws, audit/snapshot history, prize records, return actions, and fulfillment requests visible only to me so that my account is private and safe.

Acceptance criteria:

- Sensitive endpoints require authentication.
- Every sensitive query/mutation filters by `vendorId` plus authenticated `userId` or authorized role membership.
- Cross-user and cross-vendor attempts fail safely.
- Tests cover wallet, draw history, prize inventory, audit/snapshot, return, fulfillment, public projection management, and support boundaries.

### STORY-02 — See an accurate points wallet and ledger

As a player, I want to view my own point balance and ledger entries so that I can trust my funds.

Acceptance criteria:

- Wallet query is user-scoped and vendor-scoped.
- Balance derives from ledger or documented reconciliation behavior.
- Ledger entries include type, amount, timestamp, source/related IDs, idempotency key, support ID, vendor/user scope, and policy source where relevant.
- Duplicate credits/debits/returns/refunds/chargebacks/admin adjustments are idempotent or conflict safely.
- UI copy matches the selected launch funding model and does not imply cashout/fixed-dollar value unless approved.

### STORY-03 — Receive seeded/admin-issued pilot points through one clear launch path

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-14 / packs_reverse.PACKS-STORY-17; packs_evidence_ids=packs_reverse.PACKS-CAR-14 / packs_reverse.PACKS-STORY-17; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=seeded/manual credit only for MVP; import_stance=seeded/manual credit only for MVP; copied_risk_gate=yes.

As a pilot player, I want one clear way to receive seeded/admin-issued points so that I can enter the draw loop without hidden payment-provider assumptions.

Acceptance criteria:

- MVP launch path is seeded/manual pilot credit only.
- Seeded/admin credit events create immutable ledger entries.
- UI copy says seeded/admin pilot credits and does not say “buy points.”
- Manual credits/refunds/adjustments are role-restricted, vendor-scoped, reason-coded, and audited.
- No Stripe/payment checkout, multi-rail, crypto, cashout, withdrawal, bonus-value, refund promise, or `1 point = $1` copy appears unless a later approved payment scope replaces this assumption.

### STORY-04 — Understand product mode before opening

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-02 / packs_reverse.PACKS-STORY-01; packs_evidence_ids=packs_reverse.PACKS-CAR-02 / packs_reverse.PACKS-STORY-01; packs_evidence_class=direct_public_copy+direct_public_api+frontend_string_inference+oripa_recommendation; allowed_interpretation=mode boundaries only; import_stance=adopt mode boundaries; copied_risk_gate=customer copy.

As a customer, I want to know whether I am opening a one-prize pack, single pull, multi-slot pack, demo, or marketplace item so that I understand exactly what result to expect.

Acceptance criteria:

- Product detail shows mode using safe customer language.
- Backend validates `product_mode` before draw or purchase.
- Unsupported modes cannot be published or opened.
- MVP one-prize products create exactly one userPrize record.
- Marketplace and demo modes do not borrow mystery-draw proof or prize-entitlement semantics unless explicitly implemented.

### STORY-05 — Understand availability before drawing

As a player, I want list/detail/draw to agree on whether a product can be opened so that I do not waste time on unavailable products.

Acceptance criteria:

- One eligibility source checks publish status, stock, windows, auth, user limits, vendor scope, emergency stop, legal/geo/age/payment/product eligibility, region, and supported actions.
- API returns stable customer-safe reason codes.
- List/detail CTA and draw API use the same reasons.
- Draw re-checks eligibility inside the transaction.

### STORY-06 — Review disclosure before spending

As a collector, I want to see price, remaining quantity/status, prize groups, metadata, and disclosure policy before drawing so that I can make an informed decision.

Acceptance criteria:

- Detail page shows product mode, price, status, remaining/total quantity where supported, visible prize groups, featured possible pulls, category/family/tier metadata, and relevant prize metadata.
- Copy distinguishes displayed lineup from exact live odds if exact odds are not shown.
- Risky claims such as profit, guaranteed availability, live odds, EV, buyback, authentic, insured, or vaulted are hidden unless supported.
- Draw-time snapshot records customer-visible disclosure used for purchase.

### STORY-07 — Inspect exact odds/ticket table only when implemented

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-03/04/10; packs_evidence_ids=packs_reverse.PACKS-CAR-03/04/10; packs_evidence_class=direct_public_api+direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=gate exact odds/proof; import_stance=gate exact odds/proof; copied_risk_gate=yes.

As a collector, I want any displayed odds/chance/ticket information to match the draw pool used for my transaction so that I can trust the disclosure.

Acceptance criteria:

- Odds/chance/ticket intervals come from the active server-side draw pool snapshot.
- Ticket intervals, if used, are contiguous/non-overlapping and cover the configured denominator.
- Probability sums validate within approved rounding.
- Publish fails on gaps, overlaps, negative weights, zero total weight, denominator mismatch, hidden/removed items, or active rows with no eligible inventory.
- Draw records persist snapshot ID and selected ticket when ticket-based proof is enabled.
- Stale client odds/tickets are ignored.

### STORY-08 — Perform one idempotent paid draw atomically

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-STORY-04; packs_evidence_ids=packs_reverse.PACKS-STORY-04; packs_evidence_class=direct_public_api+oripa_recommendation; allowed_interpretation=idempotent paid draw constraints; import_stance=adopt idempotent paid draw constraints; copied_risk_gate=yes.

As a player, I want a draw request to charge points once and produce a durable result so that retries or failures cannot lose my points.

Acceptance criteria:

- Draw requires authentication, vendor scope, eligibility check, product-mode validation, and idempotency key.
- Wallet debit, eligibility/stock check, prize selection/reservation, draw order/result, proof/snapshot, userPrize record, and audit/outbox write commit atomically or with documented compensation.
- Exact replay returns original result; conflicting replay is rejected safely.
- Concurrency tests prevent negative balance, negative stock, oversold prizes, duplicate physical item awards, and duplicate debits.

### STORY-09 — Verify my draw after the result

As a player, I want a audit/snapshot page for my draw so that I can understand what the platform can verify.

Acceptance criteria:

- Each paid draw links to proof/snapshot record.
- Proof page includes plain-English explanation.
- Proof states exactly what it proves and does not overclaim odds/availability beyond stored data.
- Provably-fair language appears only when the customer can reproduce the ticket from disclosed seed/hash/nonce/algorithm/ticket inputs and verification steps.
- Randomness proof is separated from physical-inventory eligibility/award proof.
- Proof/history remains available after pack archive, prize return, fulfillment, refund, or support adjustment.

### STORY-10 — See my prize entitlement inventory

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-05 / packs_reverse.PACKS-STORY-06; packs_evidence_ids=packs_reverse.PACKS-CAR-05 / packs_reverse.PACKS-STORY-06; packs_evidence_class=direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=userPrize inventory pattern; import_stance=adopt userPrize inventory; copied_risk_gate=ownership/fulfillment copy.

As a player, I want every prize I win to become a durable inventory record so that I can manage it after leaving the result page.

Acceptance criteria:

- MVP `one_prize_pack` draws create exactly one userPrize record inside the draw flow.
- Inventory is vendor-scoped and user-scoped.
- Inventory shows image/name/status/source product/source draw/time/reference value where safe and available actions.
- Returned/fulfilled/locked/removed states are visible with customer-safe copy.
- Records are not hard-deleted through normal flows.

### STORY-11 — Keep physical stock eligible and reconciled

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-12; packs_evidence_ids=packs_reverse.PACKS-CAR-12; packs_evidence_class=frontend_string_inference+oripa_recommendation; allowed_interpretation=adopt defensive ops controls; import_stance=adopt defensive ops controls; copied_risk_gate=warehouse/fulfillment promises.

As an operator, I want physical inventory allocation and discrepancy controls so that live pools and fulfillment only reference eligible stock.

Acceptance criteria:

- Admin can intake or import physical items with vendor scope, condition/value/source, and audit actor.
- Items begin unallocated until explicitly allocated to a product/pool.
- Publish validation blocks unallocated, locked, reserved, awarded, removed, wrong-vendor, excluded, stale-value, or discrepancy-locked items.
- Cycle-count or mismatch discrepancy locks affected item and pauses affected product where policy requires.
- Discrepancy resolution is role-gated and audited.

### STORY-12 — Inspect structured collectible details

As a TCG collector, I want prize details to show grade, condition, card identity, image, and reference value where available so that I understand what I won or might win.

Acceptance criteria:

- Prize metadata supports image, name, game/category, set/year/card number, condition, certifier, grade, cert number, reference value, currency, value source, value timestamp, and volatility/staleness flag where available.
- Missing metadata hides gracefully.
- “Insured,” “vaulted,” “authenticated,” or “scanned” copy is not shown unless backed by approved operations/policy.
- Metadata shown at purchase/result is captured in disclosure/proof snapshot when relevant.

### STORY-13 — Convert eligible prizes back to points conditionally

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-06 / packs_reverse.PACKS-STORY-07; packs_evidence_ids=packs_reverse.PACKS-CAR-06 / packs_reverse.PACKS-STORY-07; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=return-to-points only, no cashout; import_stance=gate return-to-points; copied_risk_gate=yes.

As a player, I want to preview and confirm returning an eligible prize to points so that I do not accidentally forfeit a prize or get double-credited.

Acceptance criteria:

- Story is included in MVP only if return-to-points is advertised or exposed; otherwise all return copy/actions are hidden.
- Eligible inventory row shows return amount, value basis, expiration/freshness if applicable, and consequence before confirmation.
- Return operation is idempotent/concurrency-safe.
- Return credit writes immutable ledger entry linked to userPrize and draw order.
- Returned prize cannot be fulfilled or returned again.
- Fulfillment-pending/fulfilled/locked/non-owned/stale-value prizes cannot be returned.
- Returned points follow wallet policy and cannot double-credit paid/promotional balances.

### STORY-14 — Request admin-assisted fulfillment safely

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-07 / packs_reverse.PACKS-STORY-08/09; packs_evidence_ids=packs_reverse.PACKS-CAR-07 / packs_reverse.PACKS-STORY-08/09; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=admin-assisted fulfillment gate; import_stance=gate physical fulfillment; copied_risk_gate=yes.

As a player, I want to request fulfillment for eligible physical prizes so that I can receive valuable wins without relying on fake automation.

Acceptance criteria:

- Fulfillment request is authenticated and scoped to the user’s eligible userPrize.
- Starting fulfillment locks return-to-points.
- Address/PII access is role-gated and audited if collected.
- Unsupported countries/regions are blocked or routed to support.
- Copy says admin-assisted fulfillment unless self-serve shipping is built.
- Request creation is idempotent and links to userPrizeId, drawOrderId, drawResultId, and vendorId.
- Fulfillment statuses are customer-safe: REQUESTED, NEEDS_INFO, IN_REVIEW, APPROVED, PACKED, SHIPPED, FULFILLED, CANCELLED, REJECTED, LOST_OR_EXCEPTION.
- Fulfilled, returned, locked, removed, or non-owned prizes cannot create new fulfillment requests.

### STORY-15 — Trace a dispute from points to prize lifecycle

As a support agent, I want one lookup connecting wallet entries, draw orders, proof/snapshots, prize records, returns, fulfillment, public projections, policy versions, and audit events so that I can resolve disputes fast.

Acceptance criteria:

- Lookup supports user ID, draw/order ID, proof ID, wallet entry ID, userPrize ID, return/fulfillment ID, and public feed/projection ID where applicable.
- View is role-restricted and vendor-scoped.
- PII/security internals are redacted by role.
- Lookup action writes audit event.
- Customer-safe receipt/proof export excludes unrelated user data and active seed/security internals.

### STORY-16 — Validate product readiness before publish

As a platform/admin operator, I want unsafe product publishing blocked so that customers do not see impossible or misleading products.

Acceptance criteria:

- Publish validation checks vendor scope, product mode, status, price, stock, prize pool, draw weights/ticket intervals, required images, return policy, fulfillment policy, proof/disclosure policy, privacy/feed policy, displayed quantities, metadata, policy version links, eligibility/support actions, and claim copy.
- Errors are field-specific and actionable.
- Publish action is audited.
- Draft products may be incomplete; active products may not.

### STORY-17 — Show privacy-safe recent winners only when reversible/supportable

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-11 / packs_reverse.PACKS-STORY-15; packs_evidence_ids=packs_reverse.PACKS-CAR-11 / packs_reverse.PACKS-STORY-15; packs_evidence_class=direct_public_api+oripa_recommendation; allowed_interpretation=P2 roadmap; import_stance=P2 roadmap; copied_risk_gate=yes.

As a prospective player, I want recent wins to prove the machine is active without exposing customer identities or stale events.

Acceptance criteria:

- Feed is anonymous/masked by default.
- Feed includes only completed, non-reversed eligible draws.
- Voided/refunded/adjusted/disputed/demo/test/private draws are removed or marked according to policy.
- Feed can be disabled per vendor.
- Support/admin can trace feed item to internal draw record.
- Public DTO does not expose raw internal IDs, PII, active seeds, or warehouse data.

### STORY-18 — Try a demo opening without financial side effects

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-STORY-12; packs_evidence_ids=packs_reverse.PACKS-STORY-12; packs_evidence_class=direct_public_copy+frontend_string_inference+oripa_recommendation; allowed_interpretation=non-value demo only; import_stance=demo non-value only; copied_risk_gate=promo/free value.

As a visitor, I want to try a demo opening so that I understand the reveal experience before signing up or spending seeded/admin pilot credits.

Acceptance criteria:

- Demo opening is clearly labeled demo/non-redeemable.
- Demo uses separate demo-only pool/input namespace.
- Demo creates no wallet ledger, real proof, userPrize, fulfillment, support payout, or public feed records.
- Demo endpoint is rate-limited and cannot be replayed into real entitlement creation.
- Real promo/free value-bearing openings are separate and require eligibility, anti-abuse, and ledger/source records.

### STORY-19 — Hide unsupported roadmap actions

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-08/14/15; packs_evidence_ids=packs_reverse.PACKS-CAR-08/14/15; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=hide unsupported roadmap actions; import_stance=hide unsupported roadmap; copied_risk_gate=yes.

As a customer, I should not see trade, cash sellback, free-pack, voucher, web3, shipping automation, cashout, withdrawal, or marketplace actions until they work end to end so that I am not misled.

Acceptance criteria:

- UI hides unsupported buttons, tags, badges, routes, and copy.
- Backend rejects unsupported actions server-side.
- Backend status vocabulary may reserve future states, but customer UI does not expose unsupported actions.
- Claim validation blocks unsupported roadmap language at publish time.

### STORY-20 — Use points without cashout ambiguity

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-14 / packs_reverse.PACKS-STORY-17; packs_evidence_ids=packs_reverse.PACKS-CAR-14 / packs_reverse.PACKS-STORY-17; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=no cashout/fixed dollar equivalence; import_stance=no cashout/fixed dollar equivalence; copied_risk_gate=yes.

As a customer, I want my point balance, seeded/admin credits, adjustments, refunds, and returns to be clearly labeled so that I understand what value I can and cannot redeem.

Acceptance criteria:

- Balance distinguishes paid, promotional, bonus, refunded, and returned points if policies differ.
- UI does not imply cash value, fixed dollar equivalence, withdrawal, or cashout unless implemented and approved.
- Every debit/credit has a ledger event, reason, source object, timestamp, idempotency key, and support ID.
- Refunds, chargebacks, admin adjustments, and return-to-points cannot create duplicate credits.
- “Withdrawal” is never used ambiguously; use `cashout` for external money and `physical_fulfillment` for shipping/ordering physical prizes.

### STORY-21 — Pass eligibility checks before paid randomized openings

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-15 / packs_reverse.PACKS-STORY-18; packs_evidence_ids=packs_reverse.PACKS-CAR-15 / packs_reverse.PACKS-STORY-18; packs_evidence_class=direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation; allowed_interpretation=eligibility gate only; import_stance=adopt eligibility gate; copied_risk_gate=yes.

As an operator, I want paid openings and value-bearing actions to run only for eligible users and regions so that Oripa does not expose unsupported legal, payment, or fulfillment flows.

Acceptance criteria:

- Paid draw, wallet funding, return-to-points, fulfillment, marketplace actions, and promo/free value-bearing actions check user, vendor, age/terms, region, payment, product, and supported-action eligibility.
- Blocked users see customer-safe copy.
- Eligibility decisions are logged with support-traceable reason codes.
- Admin publish validation blocks products enabled in unsupported regions or with unsupported value claims.

### STORY-22 — Keep public APIs customer-safe

**Packs ticket metadata:** packs_source_file=docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md; packs_source_basis=packs_reverse.PACKS-CAR-13 / packs_reverse.PACKS-STORY-16; packs_evidence_ids=packs_reverse.PACKS-CAR-13 / packs_reverse.PACKS-STORY-16; packs_evidence_class=direct_public_api+oripa_recommendation; allowed_interpretation=adopt defensive hardening; import_stance=adopt defensive hardening; copied_risk_gate=no for defensive control, yes for security claims.

As an operator, I want public APIs to return safe errors and hide service internals so that product surfaces do not leak implementation details.

Acceptance criteria:

- Public health does not expose database/cache/service internals.
- Internal health is authenticated or operational-only.
- Public API errors use stable customer-safe codes and messages.
- Raw model/database errors are logged privately, not returned to clients.
- Tests cover malformed IDs, bad query params, unauthorized access, hidden/archived products, and cross-vendor access attempts.
- Public projections use allowlisted DTOs and rate limits.

### STORY-23 — Link policies to product publish and draw receipt

As a customer/support agent, I want the terms, return, fulfillment, proof, privacy/feed, and claim policies that applied at draw time to be knowable so that disputes do not depend on mutable pages.

Acceptance criteria:

- Product publish references required vendor-specific policy versions.
- Draw receipt stores policy version IDs or immutable policy snapshot covering terms, refund/return, fulfillment, fairness/proof, privacy/feed, and claim policy.
- Draw fails or product cannot publish if a required policy is missing, expired, unpublished, wrong-vendor, or silently falling back to another tenant/default.
- Support view can inspect policy versions used at draw time.


## Canonical state-machine appendix

These states are minimum modeling requirements for implementation tickets. Names can be adapted to code conventions, but transitions and mutual-exclusion constraints must survive.

### Draw/order states

- `CREATED` — request accepted but no value movement committed.
- `PAYMENT_RESERVED` — points reserved/debit pending inside transaction or compensation boundary.
- `COMMITTED` — wallet debit, selection, snapshot/proof, and userPrize creation committed.
- `REVEALED` — customer-safe result shown; source records remain committed.
- `FAILED_COMPENSATED` — failure after value movement has explicit ledger/support compensation.
- `VOIDED` — draw invalidated by support/policy with traceable reason.
- `REFUNDED` — eligible value returned according to policy; no active paid entitlement remains.
- `SUPPORT_ADJUSTED` — admin/support adjustment applied with audit trail.

### UserPrize states

- `AWARDED` — created by committed draw.
- `AVAILABLE` — customer can view supported actions.
- `RETURN_PENDING` — return-to-points started and fulfillment locked.
- `RETURNED` — return-to-points completed; no fulfillment allowed.
- `FULFILLMENT_REQUESTED` — customer/support requested handling.
- `FULFILLMENT_LOCKED` — return is disabled while fulfillment is active.
- `PACKED` — admin has packed or staged item.
- `SHIPPED` — shipment/tracking state if shipping is implemented.
- `FULFILLED` — fulfillment completed.
- `CANCELLED` — fulfillment/prize action cancelled under policy.
- `VOIDED` — entitlement invalidated under support/policy path.
- `REMOVED` — hidden/removed from normal customer action but retained for audit.
- `SUPPORT_LOCKED` — manual lock pending investigation.

### Fulfillment states

- `REQUESTED`, `NEEDS_INFO`, `IN_REVIEW`, `APPROVED`, `PACKED`, `SHIPPED`, `FULFILLED`, `CANCELLED`, `REJECTED`, `LOST_OR_EXCEPTION`.

### Required transition constraints

- A committed paid draw creates exactly one userPrize for MVP `one_prize_pack`; retries must not create duplicate userPrize records.
- Returned prizes cannot be fulfilled, packed, shipped, or marked fulfilled.
- Fulfilled/shipped prizes cannot be returned without an explicit audited reversal/exception path.
- Refunded or voided draws cannot continue as active prize entitlements.
- Fulfillment request/lock disables return-to-points until cancelled or support-reversed.
- Support adjustments must link wallet ledger, draw/order, userPrize, policy basis, actor, reason, and audit event.

## Copy-safe messaging

### Safe after P0 is implemented

> Oripa SaaS lets operators launch vendor-scoped TCG mystery-pack storefronts where customers browse mode-labeled products, complete eligibility-checked idempotent wallet-backed paid draws, receive durable userPrize records, and inspect draw history plus the approved audit/snapshot record for each paid result.

### Safe after P1 return-to-points is implemented

> Customers can convert eligible wins back into points through a confirmed, ledger-backed action.

### Safe after P1/P2 metadata and fulfillment foundation is implemented

> Customers can see structured collectible details and request admin-assisted handling for eligible physical prizes.

### Safe after odds/value-band/EV implementation

> Customers can review approved value bands and reference-value information before drawing. Odds/chance, if shown, are generated from the same transaction pool used for the draw.

### Safe only after public verifier implementation

> Customers can reproduce the draw ticket from disclosed fair-draw proof material.

### Unsafe until built and verified

- “Live odds” unless computed from active pool snapshot and kept fresh.
- “Public VRF,” “provably fair,” “verified draw,” or “fair odds” unless Oripa actually implements reproducible verifier inputs and security-reviewed proof.
- “Cash buyback,” “cashout,” “withdrawal,” “1 point = $1,” “instant sellback,” “85–90% buyback,” or “bonus value” unless exact economics, legal review, payout/points policy, and implementation exist.
- “Owned asset,” “real ownership,” “vaulted,” “insured,” “authenticated,” “scanned,” “genuine,” or “worldwide shipping” unless approved operations/legal/policy support it.
- “Marketplace trading,” “marketplace purchase,” “peer transfer,” “NFT,” “Solana,” “USDC,” “Moonpay/Coinflow,” “loan,” “rank progression,” “RUSH,” “last-one bonus,” “free packs,” “daily packs,” “affiliates,” or “promo campaigns” before those mechanics exist.

## Capability flags / copy gates

Implementation should treat high-risk surfaces as feature-gated:

- seeded/manual pilot credit provider
- payment-provider checkout, disabled for MVP unless explicitly re-scoped
- point-dollar equivalence
- refunds/chargebacks
- cashout/withdrawal
- proof page
- provably-fair/fair-odds wording
- exact odds/live odds
- ticket interval disclosure
- EV/reference value/value volatility
- product mode
- return-to-points
- fulfillment
- public winners/public activity projection
- promo/free spins
- vouchers/open-later
- marketplace
- web3 identity
- legal/geo/age eligibility
- public API exposure
- shipping automation
- policy version capture
- admin inventory allocation/cycle-count discrepancy controls

If a flag is off or policy is not approved, related UI actions, tags, badges, API affordances, and marketing copy must be hidden or replaced with safer copy.

## Glossary

- **Product mode:** Canonical backend mode for a purchasable/playable product: `one_prize_pack`, `single_pull`, `multi_slot_pack`, `marketplace_purchase`, or `demo_opening`.
- **One-prize pack:** MVP random product mode that awards exactly one userPrize.
- **Single pull:** One-card pull/case-style product; collapse into one-prize mode unless Oripa needs distinct product/legal treatment.
- **Multi-slot pack:** Product mode resolving multiple explicit slots and creating multiple userPrize records; disabled until modeled.
- **Marketplace purchase:** Known-item purchase with no random draw; roadmap/non-MVP.
- **Demo opening:** Non-value-bearing simulated opening unless explicitly implemented as promo with ledger/anti-abuse semantics.
- **UserPrize / prize entitlement:** Durable customer prize record created by successful draw or supported purchase.
- **Draw-time snapshot:** Immutable record or hash of customer-visible product configuration/disclosure and selection-relevant pool/config at purchase time.
- **Audit/proof record:** Draw record used to explain or verify the result. It may be called cryptographic/provably fair only if implementation includes seed/hash/nonce/ticket mapping, verifier instructions, test vectors, and security review.
- **Reference value:** Displayed value estimate with a source/timestamp; not insured value unless insurance/custody operations are approved.
- **Return-to-points:** Customer-confirmed conversion of an eligible userPrize into points via idempotent ledger credit. Not cash buyback or cashout.
- **Physical fulfillment:** Request/order/shipment workflow for eligible physical prizes; admin-assisted unless self-serve shipping is implemented.
- **Cashout / withdrawal:** Conversion of platform balance to external money or crypto; excluded unless legally and operationally implemented. Do not use “withdrawal” for physical fulfillment.
- **Public projection:** Privacy-safe public feed item derived from internal draw/result record.
- **Policy version:** Immutable or versioned policy artifact covering terms, refund/return, fulfillment, fairness/proof, privacy/feed, or claim rules that applied at publish/draw time.
- **Evidence class:** For Packs-derived claims, preserve whether source was public copy/UI, public API, client-bundle clue, account-flow inference, or Oripa recommendation.


## Packs evidence trace appendix for ticket generation

Any ticket generated from a consolidated CAR/story with Packs influence must copy the fields below into the ticket body. Because the two Packs files contain overlapping `packs_reverse.PACKS-CAR-*` / `packs_reverse.PACKS-STORY-*` IDs, ticket metadata must namespace IDs and include all five fields: `packs_source_file`, `packs_source_basis`, `packs_evidence_ids`, `packs_evidence_class`, and `allowed_interpretation`. Use `packs_reverse.*` for `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`; use `packs_delta.*` for `docs/packs-com-car-and-customer-stories-proposal.md`. Do not use generic/aggregated evidence-class wrappers in ticket-ready metadata. Evidence classes remain constraints: public API evidence can shape schema and tests; frontend-string evidence can only justify defensive/gated design; Oripa recommendations are planning conclusions, not Packs facts.

- **CAR-02 / STORY-02 / STORY-03 / STORY-20 — wallet, points, seeded pilot credit, no cashout ambiguity**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-14; packs_reverse.PACKS-STORY-17.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-14; packs_reverse.PACKS-STORY-17.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation`.
  - `allowed_interpretation`: wallet/ledger/copy boundaries only; seeded/admin pilot credit; no deposits/cashout/withdrawal/crypto/fixed-dollar equivalence.
  - `import_stance`: adopt wallet/ledger/copy boundaries now; do not import deposits, bonuses, cashout, withdrawal, crypto, or fixed dollar-equivalence.
  - `copied_risk_gate`: yes — wallet, refund, cashout, bonus, deposit, and dollar-equivalence copy require legal/payments/support review.

- **CAR-03 / STORY-05 / STORY-21 — eligibility/legal/geo/age/supported-action gates**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-15; packs_reverse.PACKS-STORY-18.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-15; packs_reverse.PACKS-STORY-18; Packs public copy; frontend action/rail strings.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation`.
  - `allowed_interpretation`: eligibility/supported-action gates only.
  - `import_stance`: adopt as launch safety gate before paid randomized/value-bearing actions.
  - `copied_risk_gate`: yes — paid randomized prize, fulfillment, region availability, marketplace, and value-flow copy require explicit policy approval.

- **CAR-04 / STORY-04 — product mode taxonomy**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-02; packs_reverse.PACKS-STORY-01.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-02; packs_reverse.PACKS-STORY-01; E1; E5; E6; E8; E9; E12.
  - `packs_evidence_class`: `direct_public_copy+direct_public_api+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: internal enum boundaries and gated customer-facing mode claims.
  - `import_stance`: adopt internal enum boundaries now; gate non-MVP modes.
  - `copied_risk_gate`: no for internal enum; yes for customer-facing mode claims.

- **CAR-05 / STORY-08 — idempotent paid draw**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-STORY-04; packs_reverse.PACKS-CAR-03/05/10/14.
  - `packs_evidence_ids`: packs_reverse.PACKS-STORY-04; packs_reverse.PACKS-CAR-03; packs_reverse.PACKS-CAR-05; packs_reverse.PACKS-CAR-10; packs_reverse.PACKS-CAR-14.
  - `packs_evidence_class`: `direct_public_api+oripa_recommendation`.
  - `allowed_interpretation`: transaction/idempotency constraints only; do not infer Packs implementation correctness.
  - `import_stance`: adopt transaction/idempotency constraints.
  - `copied_risk_gate`: yes for paid draw, point debit, and result/fairness copy.

- **CAR-06 / STORY-07 / STORY-09 — draw snapshot, odds/tickets, proof boundary**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-03; packs_reverse.PACKS-CAR-04; packs_reverse.PACKS-CAR-10; packs_reverse.PACKS-STORY-03; packs_reverse.PACKS-STORY-05; packs_reverse.PACKS-STORY-10.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-03; packs_reverse.PACKS-CAR-04; packs_reverse.PACKS-CAR-10; packs_reverse.PACKS-STORY-03; packs_reverse.PACKS-STORY-05; packs_reverse.PACKS-STORY-10; E3; E5; E6; E7; E8; E9; E10; E11; E12.
  - `packs_evidence_class`: `direct_public_api+direct_public_copy+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: audit/snapshot boundary now; public proof/verifier only if built.
  - `import_stance`: adopt audit/snapshot boundary now; gate public provably-fair verification.
  - `copied_risk_gate`: yes — proof/fairness words require implemented verifier, seed lifecycle, ticket mapping, test vectors, and review.

- **CAR-07 / STORY-10 — userPrize inventory**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-05; packs_reverse.PACKS-STORY-06.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-05; packs_reverse.PACKS-STORY-06; E1; E2; E12.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: durable userPrize inventory pattern only.
  - `import_stance`: adopt durable userPrize inventory now.
  - `copied_risk_gate`: no for internal records; yes for physical-card ownership/fulfillment copy.

- **CAR-08 / STORY-11 — physical inventory eligibility, allocation, discrepancy locks**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-12.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-12; bundled admin/warehouse clues from E12.
  - `packs_evidence_class`: `frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: publish/support controls and discrepancy locks; no warehouse automation promise.
  - `import_stance`: adopt publish/support controls now; gate warehouse depth to launch scope.
  - `copied_risk_gate`: no for internal controls; yes for fulfillment/refund/warehouse automation promises.

- **CAR-09 / STORY-06 / STORY-12 — disclosure, prize metadata, value freshness**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-03; packs_reverse.PACKS-CAR-09; packs_reverse.PACKS-STORY-03; packs_reverse.PACKS-STORY-14.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-03; packs_reverse.PACKS-CAR-09; packs_reverse.PACKS-STORY-03; packs_reverse.PACKS-STORY-14; E5; E6; E8; E9; E10; E11; E12.
  - `packs_evidence_class`: `direct_public_api+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: transaction-pool odds and stale/volatile value gates when displayed.
  - `import_stance`: adopt transaction-pool odds and stale/volatile value gates when displayed.
  - `copied_risk_gate`: yes for odds/value/payout/return/value-equivalence copy.

- **CAR-10 / discovery stories — category, family, browse surface**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-STORY-11.
  - `packs_evidence_ids`: packs_reverse.PACKS-STORY-11; E1; E8; E12 public navigation/category evidence.
  - `packs_evidence_class`: `direct_public_copy+direct_public_api+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: safe browse metadata after P0 safety.
  - `import_stance`: adopt safe browse metadata after P0 safety.
  - `copied_risk_gate`: yes for customer-facing mode, profitability, or unsupported category/action claims.

- **CAR-11 / STORY-13 — return-to-points**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-06; packs_reverse.PACKS-STORY-07.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-06; packs_reverse.PACKS-STORY-07; E2; E12.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation`.
  - `allowed_interpretation`: return-to-points only; no cashout/withdrawal; gate unless launch feature.
  - `import_stance`: gate unless return-to-points is a launch feature.
  - `copied_risk_gate`: yes — wallet, refund, value, forfeiture, and stale/volatile value policies required.

- **CAR-12 / STORY-14 — physical fulfillment**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-07; packs_reverse.PACKS-STORY-08; packs_reverse.PACKS-STORY-09.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-07; packs_reverse.PACKS-STORY-08; packs_reverse.PACKS-STORY-09; E1; E2; E12.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation`.
  - `allowed_interpretation`: admin-assisted fulfillment gate only unless launch fulfillment is scoped.
  - `import_stance`: gate unless physical fulfillment is launch scope.
  - `copied_risk_gate`: yes — physical operations, PII, regions, support, and legal copy required.

- **CAR-13 / STORY-15 / STORY-16 — support trace and customer history**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-10; packs_reverse.PACKS-CAR-12; packs_reverse.PACKS-STORY-10.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-10; packs_reverse.PACKS-CAR-12; packs_reverse.PACKS-STORY-10.
  - `packs_evidence_class`: `direct_public_copy+direct_public_api+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: history/support record and audit/snapshot fields; proof claims only if verifier exists.
  - `import_stance`: adopt history/support record now; gate proof fields to proof capability.
  - `copied_risk_gate`: yes for verification/provably-fair/customer-proof claims.

- **CAR-14 / STORY-17 — public winner/recent activity projection**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-11; packs_reverse.PACKS-STORY-15.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-11; packs_reverse.PACKS-STORY-15; E7.
  - `packs_evidence_class`: `direct_public_api+oripa_recommendation`.
  - `allowed_interpretation`: privacy-safe public projection only.
  - `import_stance`: roadmap/P2 only.
  - `copied_risk_gate`: yes — privacy, reversal, masking, and support trace policy required.

- **CAR-15 / STORY-19 — claim safety and unsupported roadmap suppression**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-01; packs_reverse.PACKS-CAR-08; packs_reverse.PACKS-CAR-14; packs_reverse.PACKS-CAR-15.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-01; packs_reverse.PACKS-CAR-08; packs_reverse.PACKS-CAR-14; packs_reverse.PACKS-CAR-15; E1; E2; E3; E12.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+account_flow_inference+oripa_recommendation`.
  - `allowed_interpretation`: claim/capability gates and unsupported roadmap suppression.
  - `import_stance`: adopt claim/capability gates now; marketplace/cashout/web3/fulfillment automation remain hidden unless built.
  - `copied_risk_gate`: yes for high-risk trust, marketplace, cashout, payment, fulfillment, and legal claims.

- **CAR-17 / STORY-18 — demo, promo, voucher, open-later**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-STORY-12.
  - `packs_evidence_ids`: packs_reverse.PACKS-STORY-12; product-mode clues; Collector Crypt voucher/promo patterns.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: non-value demo only; promo/free/voucher require separate controls.
  - `import_stance`: demo can be non-value-bearing roadmap; promo/free/voucher require separate eligibility, ledger, and anti-abuse controls.
  - `copied_risk_gate`: yes for any free/promo value-bearing claim.

- **CAR-18 / roadmap future-proofing — marketplace and unsupported lanes**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-08; packs_reverse.PACKS-STORY-13.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-08; packs_reverse.PACKS-STORY-13; E1; E2; E12 marketplace public nav/terms/frontend strings.
  - `packs_evidence_class`: `direct_public_copy+frontend_string_inference+oripa_recommendation`.
  - `allowed_interpretation`: roadmap only; do not import into MVP.
  - `import_stance`: roadmap only; do not import into MVP.
  - `copied_risk_gate`: yes for marketplace purchase, refund, fulfillment, and known-item purchase claims.

- **STORY-22 — public API hygiene**
  - `packs_source_file`: `docs/reference-packs-com-reverse-engineering-car-and-customer-stories.md`
  - `packs_source_basis`: packs_reverse.PACKS-CAR-13; packs_reverse.PACKS-STORY-16.
  - `packs_evidence_ids`: packs_reverse.PACKS-CAR-13; packs_reverse.PACKS-STORY-16; E4; E13.
  - `packs_evidence_class`: `direct_public_api+oripa_recommendation`.
  - `allowed_interpretation`: defensive API hardening only; no public security claim.
  - `import_stance`: adopt defensive API hardening now.
  - `copied_risk_gate`: no for defensive control; yes for any public security claim derived from it.

## Handoff to `@HRMcodingbot`

Generate implementation tickets from this canonical proposal only. Earlier source-family files, including `docs/oripa-core-car-and-customer-stories.md`, are provenance references and should not be used as parallel ticketing sources unless a ticket explicitly asks for source verification. Preserve namespaced Packs-derived evidence class/source basis where a ticket depends on Packs patterns. Start with Decision Gate 0 tickets before implementation tickets.

Recommended implementation order:

0. Resolve Decision Gate 0 or create explicit decision tickets for funding path, fulfillment scope, proof tier, return-to-points scope, odds disclosure, policy/version storage, and `single_pull` semantics. Preserve source lineage and evidence: use this consolidated proposal for tickets; carry namespaced source/evidence IDs for Packs-derived deltas.
1. Fix/verify wallet JWT user scoping and tenant boundaries.
2. Define canonical product modes and state machines before draw variants.
3. Implement immutable wallet ledger semantics for seeded/manual pilot credit only; define point classes, refunds/chargebacks/admin adjustments, and no-cashout/no-fixed-dollar/no-buy-points copy rules. Do not ticket Stripe or payment checkout unless product explicitly re-scopes funding.
4. Add centralized availability, eligibility, legal/geo/age, region, product-mode, and supported-action reason codes.
5. Implement copy/capability gates and policy version capture for publish/draw receipt.
6. Add item eligibility, allocation-to-pool, exclusions, discrepancy locks, and publish validation for physical inventory before or inside the draw transaction work.
7. Make paid draw fully idempotent, transactional, concurrent-safe, product-mode-validated, eligibility-checked, inventory-validated, snapshot/proof-linked, and userPrize-creating.
8. Build product detail disclosure: mode, price, status, supported actions, visible prize groups, odds/chance/ticket info only from transaction pool if shown, minimal metadata, safe copy.
9. Add draw history/audit/snapshot UX and support trace lookup; use provably-fair language only if the verifier tier is actually built.
10. Add public API hygiene tests and customer-safe errors: malformed IDs, bad query params, unauthorized access, hidden/archived products, cross-vendor/user attempts, and internal health privacy.
11. Add customer inventory/history surfaces.
12. Add return-to-points only after inventory + ledger + idempotency + value policy are stable.
13. Add richer discovery/metadata/family/tier surfaces.
14. If physical prizes are promised at launch, move fulfillment foundation before launch: authenticated request, return lock, PII controls, region handling, role-gated admin workflow, exception paths, and support trace. If not implemented, hide shipment/delivery/redemption/physical-claim copy.
15. Add public activity projection, value bands/EV, demo/free/promo/voucher/marketplace only after the trust foundation is stable.

## Open launch decisions / blockers

- **Funding path:** resolved for this proposal as seeded/manual pilot credit only. A future switch to Stripe or another provider requires a separate payment-provider scope covering checkout/session creation, webhook idempotency, refunds, chargebacks, ledger-linking, failure states, and copy changes.
- **Physical prize promise:** whether launch copy promises fulfillment. If yes, fulfillment foundation is P0; if no, hide all shipping/delivery/redemption claims.
- **Proof tier:** internal audit/snapshot only vs public provably-fair verifier. Public proof language requires verifier, test vectors, seed lifecycle, and review.
- **Return-to-points launch scope:** if advertised, return-to-points is P0/P1; if not, hide all return/sellback copy.
- **Odds disclosure level:** exact item odds/ticket intervals vs value bands vs no odds. Exact odds require transaction-pool-backed snapshot and validation.
- **Policy/version infrastructure:** decide whether policies are separate versioned records or embedded immutable draw policy snapshots.
- **Product mode MVP:** whether `single_pull` is distinct from `one_prize_pack` or collapsed.

After Decision Gate 0 is resolved or ticketed, this four-source reconciled proposal should supersede the individual source-family proposals for implementation ticket creation. Keep source files for evidence and detail.

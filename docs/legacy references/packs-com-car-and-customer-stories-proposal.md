# Packs.com-Derived CAR and Customer Stories Proposal for Oripa SaaS

Source reference: `docs/reference-packs-com-deep-dive.md`
Shared core: `docs/oripa-core-car-and-customer-stories.md`
Status: Oracle round-1 revised; Packs-specific delta proposal for consolidation.

## Proposal summary

Packs.com should influence Oripa SaaS through reference-specific deltas: product taxonomy, game/set/deck metadata, explicit ticket-interval disclosure, optional fair-draw verification UX, Backpack terminology, demo-opening UX, privacy-safe live-feed projection shape, and warehouse operations concepts such as intake batches, unallocated stock, pending fulfillment, and cycle-count discrepancy locks.

Core safety requirements remain owned by the shared Oripa core CARs. This document does not restate wallet ledger, atomic draw, prize entitlement, fulfillment foundation, publish validation, public feed privacy, claim validation, or support trace as new source-specific truth.

## Scope guardrails from Packs.com analysis

- Copy the domain pattern, not Packs.com branding, visual assets, exact copy, or implementation code.
- Treat public API observations as `PUBLIC_API_VERIFIED`; treat client-bundle endpoint names as `CLIENT_BUNDLE_CLUE`, not enabled-feature proof.
- Use safe Oripa vocabulary: eligible physical prizes, online reveal, snapshot-backed odds, custody/provenance/condition metadata, and policy-gated fulfillment.
- Do not claim authentic cards, ownership, cash equivalence, withdrawal rights, insurance, shipment, or provably fair verification unless Oripa has implemented and approved the capability.
- Keep marketplace singles, peer trading/user transfer, cashout, withdrawals, crypto rails, affiliates, promo credits, free spins, expected-value display, and qualitative risk labels outside MVP unless explicitly re-scoped.

## What Packs.com uniquely contributes

- Separate customer product primitives for pack-style openings and one-card/single-pull openings.
- Category/game/set/deck metadata and product-level exclusion/banned-item mechanics.
- Public probability disclosure using item chance plus ticket intervals.
- Fair draw explanation patterns using server seed hash, client seed, nonce/opening count, and deterministic ticket derivation.
- Backpack/customer inventory terminology over entitlement records.
- Public live-feed projection containing customer-safe alias, source product, item display, chance/value display, and timestamp.
- Demo opening path that can onboard users without wallet, entitlement, fulfillment, or feed mutation.
- Admin/ops clues: intake batches, unallocated stock, pending fulfillment, shipment queues, and cycle counts.

## Strengthened shared core CARs

Packs.com evidence strengthens these existing shared requirements:

- `CORE-CAR-01` — vendor-scoped catalog/product model.
- `CORE-CAR-02` — wallet/points ledger atomicity.
- `CORE-CAR-03` — pool snapshot and draw configuration versioning.
- `CORE-CAR-04` — atomic draw and prize entitlement creation.
- `CORE-CAR-05` — return-to-points policy and ledger credit.
- `CORE-CAR-06` — fulfillment lifecycle and support traceability.
- `CORE-CAR-07` — publish-time draw safety validation.
- `CORE-CAR-08` — admin inventory intake/allocation/reconciliation.
- `CORE-CAR-09` — public result projection with privacy controls.
- `CORE-CAR-10` — customer-facing claim/shipment safety policy.
- `CORE-CAR-11` — product operational status and emergency stop.
- `CORE-CAR-12` — draw-time disclosure snapshot.
- `CORE-CAR-15` — wallet invariants and negative paths.
- `CORE-CAR-16` — fair draw selection and audit trail.

## Packs.com-specific deltas to shared core CARs

Do not duplicate the shared P0 safety requirements. This section adds only Packs.com-derived product taxonomy, UX, proof-extension, and operations patterns.

### PACKS-CAR-01 — Product taxonomy: pack-style openings vs single-pull openings

- **Challenge:** Customers need to understand whether they are opening a pack-style product or a one-card pull, and the backend must prevent fixed-price commerce from accidentally using chance-draw logic.
- **Action:** Add launch product type metadata for chance products:
  - `CHANCE_PACK_OPENING`
  - `CHANCE_SINGLE_PULL`
- **Capability fields:** `vendorId`, `productType`, `purchaseMode`, `isChanceProduct`, `fulfillmentMode`, `returnPolicyId`, `proofPolicyId`, `disclosurePolicyId`, `claimPolicyFlags`.
- **Roadmap reservation:** Keep `MARKETPLACE_SINGLE` as a disabled roadmap product type unless fixed-price marketplace commerce is explicitly approved.
- **Result:** Oripa can support multiple opening surfaces without overloading one brittle `Pack` model.
- **Priority:** P0 for chance/fixed guardrails if any non-draw purchase type exists; P1 for richer taxonomy UX; roadmap for marketplace singles.
- **Acceptance:** Product type is explicit in admin, API, snapshot, and UI; draw endpoints reject non-chance products; chance products require active pool snapshot and draw policy; product type changes are blocked after publish unless a new version is created; tests cover cross-vendor and stale-product attempts.

### PACKS-CAR-02 — Pack set/deck metadata and exclusions

- **Challenge:** Set-themed pack products need to advertise source sets while excluding banned, unavailable, locked, stale, wrong-vendor, or policy-blocked items safely.
- **Action:** Add metadata fields: `game`, `categoryIds`, `setCodes`, `sourceSetDisplayName`, `deckSlug`, `excludedItemIds`, `exclusionPolicyId`, `artworkAssetIds`, `referenceDataSource`, `referenceDataFreshnessAt`.
- **Result:** Vendors can create set-themed products while keeping unavailable or excluded items out of active pools and customer-facing projections.
- **Priority:** P1.
- **Acceptance:** Publish fails if a displayed source set has no eligible inventory unless the UI labels it as thematic/example-only; excluded items cannot appear in active draw rows or featured/top-hit projections; set/category filters never cross vendor scope; product detail snapshot records set/deck/category copy shown at draw time; admin sees field-level publish errors for excluded, unavailable, locked, reserved, stale-price, or wrong-vendor items.

### PACKS-CAR-03 — Delta to CORE-CAR-03/12/16: explicit ticket-interval disclosure

- **Challenge:** Customers need inspectable odds, and support needs the exact row/ticket interval table shown at draw time.
- **Action:** Store customer-disclosable ticket intervals or equivalent normalized odds per row.
- **Required fields:** `drawPoolSnapshotId`, `denominator`, `ticketStartInclusive`, `ticketEndInclusive`, `weight`, `chanceBps` or decimal probability derived from weight/denominator, `displayValueSnapshot`, `itemDisplaySnapshot`, `eligibilityStateSnapshot`, `rowHash`.
- **Result:** Oripa can show probability per pull and audit the selected ticket against a specific immutable table without replacing core draw snapshot/proof requirements.
- **Priority:** P0 if exact odds are disclosed; otherwise P0 for whatever disclosure snapshot the customer sees.
- **Acceptance:** Active ticket intervals are contiguous/non-overlapping; total coverage equals configured denominator; probability sums are validated within approved rounding; publish fails on gaps, overlaps, negative weights, zero total weight, denominator mismatch, hidden/removed items, or active rows with no eligible inventory; draw records persist snapshot ID and selected ticket; stale client chance/ticket values are ignored; stale disclosure snapshots are handled deterministically.

### PACKS-CAR-04 — Fair draw verification seed commitment and nonce

- **Challenge:** Randomness trust requires an audit trail; customer-facing “provably fair” language is unsafe unless Oripa exposes reproducible verification data.
- **Action:** Implement fair-draw proof primitives behind policy: server seed hash commitment, client seed, nonce/opening index, algorithm version, deterministic ticket derivation, and safe seed reveal/rotation.
- **Result:** Support can audit draw proof and inventory eligibility; customers can reproduce the selected ticket only when the proof feature is enabled and the server seed has been safely revealed.
- **Priority:** P0 only if Oripa publicly claims “provably fair” or customer-reproducible draw verification at launch; otherwise P1 as a trust-layer enhancement while `CORE-CAR-16` remains P0 for support-auditable draw proof.
- **Acceptance:** Server seed commitment is immutable before eligible draw request acceptance; active server seed is never revealed before all draws using that seed are closed or the stream is rotated; one-seed-per-draw reveal occurs only after draw commit; seed stream reveal occurs only after rotation and historical draws remain tied to prior commitment; nonce allocation is serializable under concurrent opens and scoped to user/vendor/proof stream; idempotent draw retries return the same proof data and do not increment nonce again; multi-open uses deterministic sub-indexing with stable ordering; ticket derivation avoids modulo bias or documents approved rejection sampling/mapping; verification output separates random-ticket proof from physical-inventory eligibility proof; customer proof never exposes active seeds, internal inventory IDs, PII, or security-sensitive internals.

### PACKS-CAR-05 — Fairness page and verification UX

- **Challenge:** A fair algorithm is not enough if customers cannot understand what is implemented and what is only support-auditable.
- **Action:** Add a customer-facing draw verification page only for proof fields Oripa actually implements. The page must distinguish random-ticket generation proof, draw-table snapshot proof, and physical-inventory eligibility/award proof.
- **Result:** Oripa can reduce “rigged draw” support load without overclaiming reproducibility.
- **Priority:** P1, unless public proof copy is a launch claim.
- **Acceptance:** Fairness page links from product detail, footer, draw receipt, and profile history where enabled; copy cannot use “provably fair” unless the user can reproduce the ticket from disclosed proof material; if only support-auditable proof exists, customer copy says “fair draw audit record” or “draw verification receipt”; inventory proof shows customer-safe eligibility facts, not internal item IDs or warehouse locations.

### PACKS-CAR-06 — Backpack UX projection over CORE-CAR-04 user prize records

- **Challenge:** Customers need a simple place to see what they pulled and what actions are available.
- **Action:** Add “Backpack” as customer-facing terminology and projection over core `UserPrize`/prize entitlement records. It must not create a second ownership or inventory source of truth.
- **Result:** Customers can manage pulled cards without understanding internal warehouse states.
- **Priority:** P0 if physical fulfillment is in MVP; otherwise P1 UX projection.
- **Acceptance:** Backpack state derives from `UserPrize.status`, fulfillment request, return state, and lock reason; projection is user/vendor scoped; hidden/admin-only item metadata is excluded; unsupported actions are hidden and rejected server-side; returned, fulfilled, locked, disputed, removed, or non-owned prizes cannot be acted on.

### PACKS-CAR-07 — Post-pull action menu over core return/fulfillment state machine

- **Challenge:** After a pull, customers expect immediate options, but conflicting actions can corrupt entitlements and ledger state.
- **Action:** Model action availability as a menu over core entitlement, return-to-points, and fulfillment state. Do not include peer trade/exchange states in MVP unless explicitly approved.
- **Result:** Oripa can add return-to-points and fulfillment safely while deferring trade complexity.
- **Priority:** Conditional: return-to-points is P0/P1 only if advertised; fulfillment foundation is P0 if physical prizes are promised; trade/exchange is roadmap.
- **Acceptance:** Return quote expires and must be revalidated at confirmation; duplicate return confirmation does not double-credit; fulfillment request and return-to-points are mutually exclusive; fulfillment cancellation restores actions only if policy allows; admin remediation requires actor, reason, audit event, and linked ledger adjustment if money/points changes.

### PACKS-CAR-08 — Packs-derived wallet display copy note

- **Challenge:** “1 coin = $1” style copy is easy for customers but risks implying cash equivalence, withdrawal rights, or stored-value behavior.
- **Action:** Do not create a standalone Packs wallet CAR. Wallet correctness is covered by `CORE-CAR-15` and `CORE-CAR-02`. Add a UX/copy rule: customer balance may be displayed simply, but copy must not imply cash equivalence, cashout, withdrawal rights, or stored-value redemption unless approved.
- **Result:** Oripa keeps customer balance understandable without weakening ledger/compliance guardrails.
- **Priority:** Copy rule P0 wherever balance is shown.
- **Acceptance:** Balance display names the approved points/credit unit; customer-facing copy avoids “cash,” “withdraw,” or “redeem for money” unless capabilities and policies are enabled; ledger source of truth remains core-owned.

### PACKS-CAR-09 — Public live-feed projection shape

- **Challenge:** Recent pulls drive trust and excitement, but raw draw records contain private/internal data.
- **Action:** Create a public draw projection after commit with public ID, alias display, product display, item display snapshot, chance/value display if allowed, and timestamp.
- **Result:** Oripa can show social proof without leaking PII, inventory IDs, or warehouse identifiers.
- **Priority:** P2 conversion after core stability.
- **Acceptance:** Feed projection is created through an outbox/event after draw commit; projection has its own public ID, not internal `drawResultId` or `inventoryItemId`; user-identifiable display requires consent and anonymous/masked alias is default; admin/support can hide projection without deleting internal audit records; feed excludes private products, hidden products, disputed draws, test/demo draws, staff-only products, and refunded/voided results if policy requires; feed endpoint is rate-limited and uses an allowlisted DTO.

### PACKS-CAR-10 — Demo opening mode

- **Challenge:** Chance products benefit from try-before-signup, but demo draws must not mutate real wallet, inventory, fulfillment, analytics, or feed state.
- **Action:** Add demo opening endpoint/mode with a demo-only pool namespace and clearly labeled non-redeemable results.
- **Result:** Users can experience the reveal loop without operational side effects.
- **Priority:** P2.
- **Acceptance:** Demo endpoint is rate-limited by IP/device/account where available; demo products are marked `demoOnly`; demo draw uses separate algorithm/input namespace from paid draws; demo responses cannot be replayed into entitlement creation; demo results are excluded from wallet history, fulfillment, live feed, support payout tools, and odds performance analytics unless explicitly tagged.

### PACKS-CAR-11 — Customer history surfaces over core records

- **Challenge:** Customers and support need to inspect draw outcomes, ledger movement, prize state, and fulfillment movement without conflating source-of-truth tables.
- **Action:** Add separate customer history surfaces fed by core records: opening history from draw results, transaction history from wallet ledger, prize/backpack history from user prize records, fulfillment history from fulfillment requests, and support timeline from role-gated joined trace.
- **Result:** Users can self-serve questions while support can trace end-to-end incidents.
- **Priority:** P1.
- **Acceptance:** Customer histories cannot expose other users, admin notes, raw seeds, internal IDs, PII, or warehouse notes; failed/rolled-back draws appear only as failed attempts or ledger-safe reversals, not successful openings; timezones and amounts are consistent across histories.

### PACKS-CAR-12 — Admin intake, unallocated stock, pending fulfillment, and cycle-count discrepancy controls

- **Challenge:** Customer-facing odds and fulfillment are only trustworthy if warehouse stock is controlled and discrepancies lock affected items/products.
- **Action:** Add operational concepts for intake batches, unallocated items, allocated pool items, pending fulfillment queue, shipment queue, and cycle-count discrepancies.
- **Minimum data model:** `InventoryItem`, `InventoryIntakeBatch`, `PoolAllocation`, `CycleCount`, `CycleCountDiscrepancy`, `AdminAuditEvent`, `FulfillmentReservation`.
- **Result:** Oripa vendors can onboard stock, publish pools, fulfill claims, and reconcile discrepancies safely.
- **Priority:** P0 for item eligibility states, allocation to pool, publish blocking, discrepancy lock, and audit log; P1 for intake batch UI, unallocated stock queue, and pending fulfillment queue; P2/Roadmap for full cycle-count workflow, advanced reconciliation, and warehouse automation.
- **Acceptance:** Items cannot enter a live pool until allocated and eligible; missing item during cycle count locks item and pauses affected product if item is in an active snapshot policy; wrong-condition/wrong-card discrepancy blocks fulfillment until resolved; allocated item cannot be deleted and must transition to removed/locked with audit reason; pool publish fails if any row references unallocated, locked, reserved, awarded, removed, wrong-vendor, or excluded inventory.

### PACKS-CAR-13 — Roadmap qualitative risk label with approved source

- **Challenge:** Risk labels can help merchandising but can mislead if they imply expected profit or are stale after pool changes.
- **Action:** Keep risk labels disabled by default. Enable only after policy, computation, freshness, and claim-review gates exist.
- **Result:** Oripa can later compare volatility without unsupported EV/profit claims.
- **Priority:** Roadmap / disabled by default.
- **Acceptance:** Risk label cannot be shown unless the source is snapshot-backed and policy-approved; label wording is qualitative and avoids implying expected profit; risk calculation version is stored; label is hidden when pool, price, reference values, or distribution changes make it stale.

### PACKS-CAR-14 — Customer-facing policy/link placement for CORE-CAR-10 claims

- **Challenge:** Chance commerce with physical fulfillment needs clear policy access at the point of decision, but policy truth remains core-owned.
- **Action:** Add vendor-aware placement for fairness/proof, refund/return, terms, privacy, delivery, account, and support/help-center links.
- **Result:** Customers can resolve policy questions before depositing/opening/requesting fulfillment.
- **Priority:** P1 before public launch.
- **Acceptance:** Product detail links to the exact policy versions applicable at draw time; draw receipt stores `policyVersionIds` for terms, refund/return, fulfillment, fairness/proof, and privacy/feed policy where applicable; vendor-specific policies cannot fall back silently to the wrong tenant’s policy.

## Evidence mapping appendix

Evidence classes:

- `PUBLIC_API_VERIFIED`: unauthenticated public API response captured with URL, status, timestamp, sanitized payload, and fixture hash.
- `UI_OBSERVED`: rendered page/browser observation captured with timestamp and screenshot/browser-capture note.
- `CLIENT_BUNDLE_CLUE`: endpoint, route, asset, or string observed in shipped frontend bundles. This cannot justify enabled product scope unless corroborated by `PUBLIC_API_VERIFIED` or `UI_OBSERVED` evidence.
- `INFERENCE`: Oripa requirement inferred from observed patterns and constrained by shared core safety requirements.

Retained artifact bundle: `docs/reference-artifacts/packs-com/20260529T070709+0700/`.

Required retained artifacts for future updates:

- sanitized screenshots or browser-capture notes for UI-observed claims;
- captured API payloads for public API claims;
- bundle snippets or bundle hash lines for client-bundle clues;
- URL/path, HTTP status where applicable, capture timestamp, fixture hash, and allowed interpretation for each artifact.

CAR/story evidence map:

- `PACKS-CAR-01`, `PACKS-STORY-01`, `PACKS-STORY-02`: artifact IDs `PACKS-API-PACKS-20260529`, `PACKS-UI-WEBEXTRACT-20260529`; classes `PUBLIC_API_VERIFIED`, `UI_OBSERVED`, `INFERENCE`; allowed interpretation is product taxonomy and category/filter requirements, not marketplace MVP scope.
- `PACKS-CAR-02`: artifact IDs `PACKS-API-PACKS-20260529`, `PACKS-API-CASES-L20-20260529`, `PACKS-BUNDLE-HASHES-20260529`; classes `PUBLIC_API_VERIFIED`, `CLIENT_BUNDLE_CLUE`, `INFERENCE`; allowed interpretation is metadata/exclusion controls, not proof of Packs operational implementation quality.
- `PACKS-CAR-03`, `PACKS-STORY-03`: artifact IDs `PACKS-API-PACKS-20260529`, `PACKS-API-CASE-ETERNITIES-20260529`, `PACKS-API-CASE-ETERNITIES-STATS-20260529`; classes `PUBLIC_API_VERIFIED`, `INFERENCE`; allowed interpretation is ticket-interval or normalized-odds disclosure when exact odds are shown.
- `PACKS-CAR-04`, `PACKS-CAR-05`, `PACKS-STORY-04`, `PACKS-STORY-05`: artifact IDs `PACKS-UI-WEBEXTRACT-20260529`, `PACKS-BUNDLE-HASHES-20260529`; classes `UI_OBSERVED`, `CLIENT_BUNDLE_CLUE`, `INFERENCE`; allowed interpretation is optional fair-draw verification UX, not a public “provably fair” claim until reproducible proof exists in Oripa.
- `PACKS-CAR-06`, `PACKS-CAR-07`, `PACKS-STORY-06`, `PACKS-STORY-07`, `PACKS-STORY-08`, `PACKS-STORY-09`: artifact IDs `PACKS-UI-WEBEXTRACT-20260529`, `PACKS-BUNDLE-HASHES-20260529`; classes `UI_OBSERVED`, `CLIENT_BUNDLE_CLUE`, `INFERENCE`; allowed interpretation is customer projection/action-menu requirements over core entitlement records.
- `PACKS-CAR-08`: artifact IDs `PACKS-UI-WEBEXTRACT-20260529`; classes `UI_OBSERVED`, `INFERENCE`; allowed interpretation is balance-display copy guardrail only.
- `PACKS-CAR-09`, `PACKS-STORY-10`: artifact IDs `PACKS-API-LIVEFEED-20260529`; classes `PUBLIC_API_VERIFIED`, `INFERENCE`; allowed interpretation is privacy-safe public projection shape.
- `PACKS-CAR-10`, `PACKS-STORY-11`: artifact IDs `PACKS-BUNDLE-HASHES-20260529`; classes `CLIENT_BUNDLE_CLUE`, `INFERENCE`; allowed interpretation is a roadmap demo mode with no operational side effects, not a launch requirement.
- `PACKS-CAR-11`, `PACKS-STORY-15`: artifact IDs `PACKS-BUNDLE-HASHES-20260529`; classes `CLIENT_BUNDLE_CLUE`, `INFERENCE`; allowed interpretation is separated customer histories and role-gated support timeline.
- `PACKS-CAR-12`, `PACKS-STORY-12`, `PACKS-STORY-13`, `PACKS-STORY-14`: artifact IDs `PACKS-API-PACKS-20260529`, `PACKS-API-CARDS-L5-20260529`, `PACKS-BUNDLE-HASHES-20260529`; classes `PUBLIC_API_VERIFIED`, `CLIENT_BUNDLE_CLUE`, `INFERENCE`; allowed interpretation is admin intake/allocation/unallocated-stock/cycle-count discrepancy control requirements, not evidence that every Packs admin feature is enabled.
- `PACKS-CAR-13`: artifact IDs `PACKS-API-PACKS-20260529`, `PACKS-API-CASE-ETERNITIES-STATS-20260529`; classes `PUBLIC_API_VERIFIED`, `INFERENCE`; allowed interpretation is roadmap qualitative label guardrail, not MVP scope or expected-value display.
- `PACKS-CAR-14`: artifact IDs `PACKS-UI-WEBEXTRACT-20260529`; classes `UI_OBSERVED`, `INFERENCE`; allowed interpretation is policy/link placement and immutable version capture.

The artifact ID manifest is retained at `docs/reference-artifacts/packs-com/20260529T070709+0700/manifest.md`.

## Minimum implementation data model appendix

### Product

- `id`
- `vendorId`
- `productType`
- `slug`
- `status`
- `priceAmount`
- `priceCurrencyOrPointsUnit`
- `game/category/set metadata`
- `proofPolicyId`
- `returnPolicyId`
- `fulfillmentPolicyId`
- `disclosurePolicyId`
- `claimPolicyFlags`
- `policyVersionIds` or `DrawPolicySnapshotId` covering terms, refund/return, fulfillment, fairness/proof, privacy/feed, and vendor-specific claim policy
- `currentPublishedVersionId`
- created/updated/audit timestamps and actors

### ProductVersion / DrawConfigVersion

- `productId`
- `version`
- `status`
- `denominator`
- `algorithmVersion`
- `poolSnapshotId`
- `disclosureSnapshotId`
- `publishedAt`
- `retiredAt`
- `configHash`
- immutable policy snapshot reference or `policyVersionIds` for terms, refund/return, fulfillment, fairness/proof, privacy/feed, and claim policy; publish fails if vendor-specific policy is missing or would silently fall back to another tenant/default policy

### DrawPoolSnapshot

- `id`
- `vendorId`
- `productId`
- `productVersionId`
- `denominator`
- `totalWeight`
- `rows[]`
- `snapshotHash`
- `createdAt`

### DrawPoolRow

- `rowId`
- `prizeId/itemId` or `prizeTemplateId`
- `inventoryItemId` if item-specific
- `weight`
- `chanceBps`
- `ticketStartInclusive`
- `ticketEndInclusive`
- `displayNameSnapshot`
- `imageSnapshot`
- `referenceValueSnapshot`
- `eligibilityStateSnapshot`
- `rowHash`

### FairnessProofStream

- `id`
- `vendorId`
- `userId`
- `serverSeedHash`
- server seed reveal status
- `clientSeed`
- `nonce`
- active/rotated/revealed timestamps
- `algorithmVersion`

### DrawResult

- `id`
- `vendorId`
- `userId`
- `productId`
- `productVersionId`
- `idempotencyKey`
- `ledgerDebitEntryId`
- `poolSnapshotId`
- `disclosureSnapshotId`
- `proofStreamId`
- `nonce`
- `subIndex`
- `selectedTicket`
- `selectedRowId`
- `selectedInventoryItemId`
- `userPrizeId`
- `status`
- `failureReason` if failed
- draw receipt `policyVersionIds` or immutable `DrawPolicySnapshotId` covering terms, refund/return, fulfillment, fairness/proof, privacy/feed, and vendor-specific claim policy; draw fails if required vendor policy is missing, expired, unpublished, or would fall back across tenants
- audit timestamps

### UserPrize / PrizeEntitlement

- `id`
- `vendorId`
- `userId`
- `drawResultId`
- `inventoryItemId`
- `status`
- `returnEligibility`
- `fulfillmentEligibility`
- `lockReason`
- audit timestamps

### PublicFeedEvent

- `publicId`
- `vendorId`
- `productPublicId`
- internal link to `drawResultId`
- `aliasDisplay`
- `itemDisplaySnapshot`
- `chanceDisplay`
- `valueDisplay`
- `visibilityStatus`
- `createdAfterCommitAt`
- `hiddenReason`

### PolicyVersion

- `vendorId`
- `policyType`
- `version`
- `effectiveAt`
- `contentHash`
- `publicUrl`

### DrawPolicySnapshot

- `id`
- `vendorId`
- `productId`
- `productVersionId`
- `termsPolicyVersionId`
- `refundReturnPolicyVersionId`
- `fulfillmentPolicyVersionId`
- `fairnessProofPolicyVersionId`
- `privacyFeedPolicyVersionId`
- `claimPolicyVersionId`
- `contentHash`
- `createdAt`
- `publishedAt`
- `retiredAt`
- invariant: no cross-tenant fallback and no draw against missing, unpublished, expired, or vendor-inapplicable policies

## Required negative-path acceptance criteria

### Draw/wallet/pool

- Insufficient balance fails before randomness and before inventory reservation.
- Duplicate draw idempotency key returns the same result or a safe conflict.
- Same idempotency key with different payload is rejected.
- Two concurrent draws cannot award the same physical item.
- Pool depleted between page load and draw fails safely.
- Stale price/disclosure snapshot is handled deterministically.
- Product paused/out-of-stock/archived rejects draw server-side.
- Hidden, removed, locked, reserved, awarded, excluded, zero-weight, or wrong-vendor items cannot be selected.
- Failure after debit but before award rolls back or creates a compensating ledger event with support trace.

### Fairness/proof

- Invalid, too-long, empty, or unsafe-encoding client seed is rejected.
- Client seed change affects only future proof streams.
- Seed reveal cannot expose active future draws.
- Nonce race under concurrent opens is impossible.
- Verification fails closed if algorithm version is unknown or proof material is incomplete.

### Fulfillment/return

- Returned prize cannot be fulfilled.
- Fulfillment-pending prize cannot be returned unless cancellation policy restores eligibility.
- Unsupported address/country blocks request before final submission.
- Address changes after request do not mutate the shipment address snapshot without audit.
- Fulfilled, voided, locked, disputed, removed, or non-owned prizes cannot create fulfillment requests.

### Public/live/demo/API

- Demo draw cannot create entitlements, wallet entries, shipments, or live-feed events.
- Public feed excludes hidden/private/test/demo/voided records.
- Public APIs do not expose raw internal IDs, admin states, PII, warehouse data, active seeds, or hidden product metadata.
- Cross-vendor and cross-user object access attempts fail.
- Public endpoints are rate-limited.

## Packs.com-derived customer stories

### PACKS-STORY-01 — Browse by game/category

As a collector, I want to filter products by game/category such as Pokémon or MTG so that I can quickly find openings relevant to what I collect.

- **Acceptance:** Category tabs update product list without crossing vendor scope; empty categories hide or show a safe empty state; product URLs remain shareable.

### PACKS-STORY-02 — Compare pack products by set and price

As a collector, I want pack cards to show source set, game, artwork, and price so that I can compare entry-level and premium openings.

- **Acceptance:** Pack card shows name, game/category, price, image, and link; hidden/unavailable packs cannot be opened; price shown matches draw debit snapshot.

### PACKS-STORY-03 — Inspect one-card pull odds

As a collector, I want to inspect possible pulls, values, and probabilities before opening a single-pull product so that I understand the risk.

- **Acceptance:** Customer sees either exact item odds or approved value bands depending on disclosure policy; if exact odds are not implemented, copy must not imply item-level odds; snapshot ID is captured on draw; unpublished/stale pool cannot be opened.

### PACKS-STORY-04 — Open with implemented verification/audit data

As a collector, I want my opening receipt to include implemented verification/audit data so that I can understand the draw inputs and, where supported, reproduce the selected ticket.

- **Acceptance:** Receipt includes only implemented proof fields; do not show “reproducible” copy unless the customer can recompute the ticket from disclosed fields; verification page fails closed when proof material is unavailable or incomplete.

### PACKS-STORY-05 — Change my client seed

As a collector, I want to change my client seed so that I have visible influence over future fair-draw inputs when fair-draw verification is implemented.

- **Acceptance:** Changing seed applies only to future draws; past receipts preserve old seed; invalid, empty, too-long, or unsafe-encoding seeds are rejected; action is logged.

### PACKS-STORY-06 — See pulled cards in my backpack

As a collector, I want a backpack page showing my pulled cards so that I can decide what eligible action to take next.

- **Acceptance:** Backpack lists only my entitlements; each item shows state and allowed actions; items locked for fulfillment/return cannot be selected for conflicting actions; hidden/admin metadata is excluded.

### PACKS-STORY-07 — Return eligible prize to points

As a collector, I want to return an eligible pulled item to points so that I can open another product without waiting for fulfillment.

- **Acceptance:** Return quote is shown before confirmation and expires; confirmation creates one ledger credit and marks entitlement returned; repeated submissions are idempotent; returned prize cannot later be fulfilled.

### PACKS-STORY-08 — Request physical delivery

As a collector, I want to request shipment of selected eligible pulled cards so that I receive the physical prizes when Oripa/vendor fulfillment supports it.

- **Priority note:** P0 only if physical fulfillment is promised at launch; otherwise this story must be hidden/deferred.
- **Acceptance:** Shipment request requires a valid address and supported destination; selected entitlements lock; address snapshot is immutable without audit after request; support/admin shipment status is visible; cancelled shipment unlocks or transitions entitlements only when policy allows.

### PACKS-STORY-09 — Review opening and transaction history

As a collector, I want separate opening history and wallet transaction history so that I can understand what I pulled and what happened to my balance.

- **Acceptance:** Opening history links to draw proof/audit receipt and entitlement; transaction history lists deposits/debits/credits/refunds; failed draws do not appear as successful openings; rolled-back debits appear as safe reversals.

### PACKS-STORY-10 — Watch recent public pulls

As a visitor, I want to see recent public pulls so that I can judge activity and possible outcomes.

- **Acceptance:** Live feed uses anonymous/masked aliases by default; user-identifiable display requires consent; only committed eligible draws appear; feed item links to public product/item pages where allowed; no private addresses, emails, internal IDs, active seeds, or warehouse data leak.

### PACKS-STORY-11 — Try a demo opening

As a visitor, I want to try a demo opening so that I understand the reveal experience before signing up or depositing credits.

- **Acceptance:** Demo result is clearly non-redeemable; demo never creates wallet/inventory/shipment/feed records; demo endpoint cannot be abused to open real products; demo is rate-limited.

### PACKS-STORY-12 — Admin intakes new physical stock

As a vendor admin, I want to create an intake batch for new cards so that stock enters Oripa with traceable provenance, condition, and status.

- **Acceptance:** Intake batch records source, item details, condition/value, actor, and timestamp; items begin unallocated; allocation requires eligibility checks; wrong-vendor or duplicate items are blocked.

### PACKS-STORY-13 — Admin allocates stock to a product pool

As a vendor admin, I want to allocate eligible stock to a product pool so that published odds only reference real available items.

- **Acceptance:** Allocation requires vendor scope, eligible item status, quantity/item uniqueness policy, exclusion policy, and audit reason; allocated items cannot be simultaneously allocated elsewhere unless policy permits quantity; excluded/banned/unavailable items block publish; pool snapshot records item eligibility.

### PACKS-STORY-14 — Admin runs cycle count and locks discrepancies

As a vendor admin, I want to run cycle counts so that missing or mismatched stock cannot continue appearing in live draws.

- **Acceptance:** Discrepancies lock affected items and optionally pause affected products; audit log records discrepancy and resolution; customers cannot draw locked items; wrong-condition or missing-item discrepancies block fulfillment until resolved.

### PACKS-STORY-15 — Support investigates a disputed draw

As support, I want one timeline linking wallet debit, draw proof, selected ticket, entitlement, live-feed projection, and fulfillment/return state so that I can resolve disputes quickly.

- **Acceptance:** Timeline is read-only except authorized remediation actions; every transition includes actor/time/reason; support view redacts PII and active seed/security internals by role; every lookup writes an audit event; support can export customer-safe receipt/proof without exposing unrelated user data.

## Suggested priority cut

Shared Oripa core owns launch-safety P0 requirements for authenticated user/vendor scoping, points ledger correctness, idempotency, atomic paid draw, pool snapshot/versioning, publish validation, prize entitlement state machine, fulfillment foundation when promised, return-to-points when advertised, support trace, and public API privacy. This Packs proposal lists only Packs-derived priority deltas.

### Packs-specific P0 deltas — launch safety additions

- Product taxonomy guardrails for `CHANCE_PACK_OPENING` vs `CHANCE_SINGLE_PULL`, including server-side rejection of non-chance products by draw endpoints.
- Ticket-interval or normalized-odds disclosure invariants when exact odds are shown.
- Backpack projection only if physical fulfillment or customer prize management is visible at launch; source of truth remains core `UserPrize`/entitlement records.
- Packs-derived inventory controls: item eligibility states, allocation-to-pool validation, unallocated stock exclusion, discrepancy locks, and audit events.
- Policy/link version placement: draw receipt stores immutable policy snapshot/version IDs for terms, refund/return, fulfillment, fairness/proof, privacy/feed, and vendor-specific claim policy.

### Packs-specific P1 deltas — near-MVP trust and usability

- Category/game/set/deck filters.
- Pack-style vs single-pull customer UX.
- Customer backpack projection.
- Opening, transaction, prize, and fulfillment histories.
- Fair draw verification page only if proof data is reproducible; otherwise customer-safe audit receipt.
- Client seed change only if fair-draw verification is implemented.
- Admin intake batch and unallocated stock UI.
- Basic cycle-count discrepancy lock workflow.
- Policy/support/fairness links with policy version capture.

### Packs-specific P2 deltas — conversion after core stability

- Public live feed.
- Demo openings.
- Rich reveal UX.
- Advanced admin cycle-count workflow.
- Qualitative risk labels only behind policy/computation gates.

### Roadmap / explicit non-goals unless re-scoped

- Marketplace singles.
- Peer trading/user-to-user transfer.
- Cashout, withdrawal, crypto rails, or stored-value semantics.
- Affiliates, promo campaigns, rewards, free spins.
- Expected value display.
- Self-serve shipping automation beyond fulfillment foundation.

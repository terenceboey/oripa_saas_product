# Collector Crypt-Derived CAR and Customer Stories Proposal for Oripa SaaS

Source reference: `docs/reference-collectorcrypt-deep-dive.md`

Status: draft proposal before Oracle audit.

## Executive thesis

Collector Crypt is the strongest reference for the asset-ownership and custody lifecycle around a gacha/oripa product. It frames physical collectibles as digitally managed assets: authenticated, scanned, insured/reference-valued, linked to a profile or wallet, tradeable, transferable, and redeemable. Its gacha app appears to connect pack opening to a broader inventory/marketplace/vault system.

For Oripa SaaS, Collector Crypt should inform four product surfaces:

1. **Durable user prize inventory** — a won prize is an owned asset with status, value metadata, grade metadata, and custody/fulfillment state.
2. **Lifecycle after draw** — return-to-points, fulfillment request, future listing/transfer/trading.
3. **Acquisition mechanics** — free packs/free spins and purchased-pack vouchers as roadmap, not immediate MVP unless anti-abuse is ready.
4. **Marketplace readiness** — data model should not block future marketplace/trading, but MVP should not claim marketplace, loans, web3, or crypto rails.

Do not add Privy, Solana, Moonpay, Coinflow, NFTs, collateralization, or loans without explicit approval. The Oripa SaaS MVP should stay on JWT + points wallet + provably fair draw + inventory + support trace.

## Evidence extracted from Collector Crypt

Observed public patterns:

- Positioning: “Like Fort Knox, but with a marketplace.”
- Positioning: “Your Digital Bridge for Real-World Collectibles.”
- Vault physical collectibles securely.
- Trade collectibles with others.
- Collateralize assets for loans.
- Secured vaults include PSA, PWCC, and ALT.
- Cards are authenticated, scanned, and linked to a profile or wallet.
- Buy, sell, and transfer cards.
- Wallet integration: Privy.
- Gacha categories: All, Pokemon, Sports, One Piece, Pop.
- Pack denominations: PKMN 25/50/250/1000, ONEPIECE 250, ANIME 75, SEALED 80, SPORTS 100, FIREGRASS 100.
- Prize cards show image, title/name, insured value, grade.
- Frontend bundle endpoint names indicate flows around openPack, generatePack, generatePurchasedPack, freePack, freeSpins, purchasedPacks, usePurchasedPack, getRecentWinners, getAllWinners, getWeightedInsuredValue, getNfts, createNftTransfer, buyback, Coinflow.

## Guardrails for Oripa SaaS adoption

- Use “reference value” unless Oripa actually provides insured custody.
- Keep web3/wallet abstraction as future-compatible design, not MVP dependency.
- Avoid collateral/loan language entirely.
- Treat purchased-pack voucher/free-spin mechanics as post-MVP unless anti-abuse and ledger semantics are ready.
- Public winner feeds must be privacy-safe.
- Buyback should be points-return in MVP.
- Marketplace/trading/transfer should be roadmap unless implemented end to end.

## CAR proposal — Collector Crypt-derived

### CAR-CC-01 — Durable asset inventory

- **Challenge:** A draw result that only appears once on a result screen does not feel like real ownership and is hard for support to trace.
- **Action:** Create a user prize inventory model that records every won prize as a durable owned asset linked to draw/order/proof/wallet records.
- **Result:** Customers can revisit owned prizes, support can trace disputes, and future fulfillment/marketplace features have a stable foundation.
- **MVP priority:** P0.
- **Acceptance:** Every paid draw creates exactly one user prize record; status is queryable by user; vendor/user scope is enforced.

### CAR-CC-02 — Structured card metadata

- **Challenge:** Grade/value details embedded in free-text names are hard to filter, display, audit, and fulfill.
- **Action:** Add structured prize metadata for grading company, grade label, year, set, card number, parallel/edition, image, and reference value.
- **Result:** Product pages, inventory, support, and fulfillment can show consistent collectible details.
- **MVP priority:** P1.
- **Acceptance:** Prize metadata appears on pack detail, result, inventory, and support views; missing fields degrade gracefully.

### CAR-CC-03 — Reference/insured value policy

- **Challenge:** Customers care about value, but “insured value” is misleading unless actual custody insurance exists.
- **Action:** Store value metadata as `referenceValue` with source/type; optionally add `insuredValue` only if insurance/custody is real.
- **Result:** Oripa can display values transparently without overclaiming insurance.
- **MVP priority:** P1.
- **Acceptance:** UI labels value source; admin must choose source/type; “insured” copy is blocked unless policy enabled.

### CAR-CC-04 — Prize lifecycle status machine

- **Challenge:** Owned assets can be kept, returned, fulfilled, locked, cancelled, or later listed/transferred; ad hoc booleans will break.
- **Action:** Implement explicit `UserPrize` status transitions with audit logs and role-gated operations.
- **Result:** Customer inventory and ops workflows remain consistent as features expand.
- **MVP priority:** P0/P1.
- **Acceptance:** Valid transitions are enforced; repeated return/fulfillment actions are blocked; support sees transition history.

### CAR-CC-05 — Return-to-points liquidity

- **Challenge:** Customers need a clear liquidity path after winning an unwanted prize.
- **Action:** Implement idempotent return-to-points for eligible user prizes, creating wallet ledger credit and updating prize status.
- **Result:** Customers can continue playing without manual support while finance retains an audit trail.
- **MVP priority:** P0/P1.
- **Acceptance:** Return amount is previewed; operation is idempotent; user cannot return another user's prize; ledger and prize status update atomically.

### CAR-CC-06 — Fulfillment request foundation

- **Challenge:** Physical collectibles eventually require redemption/shipping, but full logistics can be deferred.
- **Action:** Add admin-assisted fulfillment request lifecycle for owned physical prizes.
- **Result:** MVP can handle real physical wins without needing full automated shipping.
- **MVP priority:** P1.
- **Acceptance:** Customer can request fulfillment; support/admin sees queue; prize is locked while request is pending; audit trail records actions.

### CAR-CC-07 — Marketplace-ready asset model

- **Challenge:** Future buy/sell/trade features are hard if inventory records cannot represent custody, listing, transfer, or lock states.
- **Action:** Design user prize and optional vault-asset fields to support future marketplace/listing/transfer without exposing those features now.
- **Result:** MVP remains small while avoiding a rewrite when marketplace is approved.
- **MVP priority:** Design now, implement later.
- **Acceptance:** Roadmap states are documented; UI hides unimplemented actions.

### CAR-CC-08 — Pack denominations and compact product grid

- **Challenge:** Customers need a quick way to compare pack products by category and denomination.
- **Action:** Show compact pack cards using category + denomination naming like PKMN 25/50/250 while preserving full pack titles/details.
- **Result:** Storefront becomes easier to scan on mobile and across categories.
- **MVP priority:** P1.
- **Acceptance:** Pack card includes category, price/points, title, image, and availability; sorting is predictable.

### CAR-CC-09 — Purchased pack/voucher roadmap

- **Challenge:** Immediate draw is simple, but promotions, gifts, bundles, and open-later flows need pack ownership before opening.
- **Action:** Define a future `PackVoucher` / `PurchasedPack` model while keeping MVP immediate paid draw.
- **Result:** Product can later support free packs, gifts, bundles, and delayed reveal without corrupting draw records.
- **MVP priority:** Roadmap; not MVP unless user asks.
- **Acceptance:** Proposal specifies statuses AVAILABLE, OPENED, EXPIRED, CANCELLED and link to open draw order.

### CAR-CC-10 — Free pack/free spin anti-abuse gate

- **Challenge:** Free acquisition mechanics increase conversion but can be farmed by bots and duplicate accounts.
- **Action:** Defer public free spins until centralized eligibility, rate limits, identity controls, and ledger boundaries exist.
- **Result:** Oripa can use free spins later without destroying economics or trust.
- **MVP priority:** P2/roadmap.
- **Acceptance:** Free spin story requires abuse controls before implementation; free results are clearly non-real or promo-scoped.

### CAR-CC-11 — Public winners / all winners feed

- **Challenge:** Social proof increases trust, but public feeds can leak private behavior.
- **Action:** Add privacy-safe recent/all-winners projections backed by draw records, optionally filterable by category/pack/value tier.
- **Result:** Customers can see active wins while privacy and auditability remain intact.
- **MVP priority:** P1/P2.
- **Acceptance:** Feed excludes private users/results; support can trace feed items; vendor scoping is enforced.

### CAR-CC-12 — Identity future-proofing

- **Challenge:** Current JWT email accounts are enough for MVP, but future wallet-linked ownership should not force a rewrite.
- **Action:** Keep `User` as canonical owner and design optional linked identity records for wallet/social auth later.
- **Result:** Oripa can remain simple now while supporting wallet/Privy-like extensions later.
- **MVP priority:** Design consideration; no web3 implementation.
- **Acceptance:** Draw, inventory, and wallet records key to userId, not mutable email or external wallet address.

### CAR-CC-13 — Custody and fulfillment metadata

- **Challenge:** Physical prizes need custody state, scan/image source, and fulfillment eligibility to support real-world operations.
- **Action:** Add custody status and fulfillment eligibility fields to prize/user-prize records.
- **Result:** Customers and support know whether an item can be fulfilled, returned, or is locked.
- **MVP priority:** P1.
- **Acceptance:** Status values are explicit; fulfillment request locks prize; support can update custody state with audit log.

### CAR-CC-14 — Support trace from asset to money flow

- **Challenge:** Disputes require tracing from customer asset to draw proof and wallet ledger.
- **Action:** Build support lookup around user prize, draw order/result, fairness proof, wallet entries, return/fulfillment events.
- **Result:** Support can answer “what happened to my prize/points?” without database spelunking.
- **MVP priority:** P0/P1.
- **Acceptance:** Role/vendor-scoped support endpoint returns full chain; no cross-user leakage.

## Customer stories — Collector Crypt-derived

### Epic CC-E1 — Own prizes as durable assets

#### STORY-CC-ASSET-01 — View won prizes in inventory
As a customer, I want each won prize to appear in my inventory so that my draw result feels like a durable owned asset.

Acceptance criteria:
- Every successful paid draw creates a user prize record.
- Inventory is authenticated and user-scoped.
- Inventory item shows prize image, name, grade/reference metadata, source pack, draw time, and status.
- Inventory excludes prizes owned by other users or vendors.

#### STORY-CC-ASSET-02 — View prize detail
As a customer, I want to open a prize detail page so that I can inspect metadata and available actions.

Acceptance criteria:
- Detail shows grade company, grade label, year/set/card number when available.
- Detail shows reference value and source label when available.
- Detail links back to draw history/proof.
- Detail shows only valid actions for current status.

#### STORY-CC-ASSET-03 — See asset status
As a customer, I want to know whether my prize is owned, returned, fulfillment-requested, fulfilled, locked, or cancelled so that I understand what I can do next.

Acceptance criteria:
- Status labels are human-readable.
- Status changes are reflected immediately after actions.
- Invalid actions are disabled with explanation.
- Support/admin status changes are visible in customer-safe copy.

### Epic CC-E2 — Metadata and value transparency

#### STORY-CC-META-01 — Show structured grade metadata
As a customer, I want grade details shown separately from the title so that I can compare collectibles accurately.

Acceptance criteria:
- Prize card/detail supports grading company and grade label.
- Unknown grades display as “Ungraded” or hidden by policy.
- Admin can enter/update grade metadata before publish.
- API returns structured fields, not only display name.

#### STORY-CC-VALUE-01 — Show reference value safely
As a customer, I want to see a reference value with source context so that I understand approximate prize value without being misled.

Acceptance criteria:
- UI label says reference value unless insured custody is actually enabled.
- Value includes currency.
- Admin can set source/type.
- Customer draw/result snapshots preserve value shown at draw time.

### Epic CC-E3 — Liquidity and fulfillment

#### STORY-CC-RETURN-01 — Return owned prize to points
As a customer, I want to return an eligible owned prize for points so that I can keep using the platform.

Acceptance criteria:
- Return amount is previewed before confirmation.
- Return action is unavailable for ineligible or already returned prizes.
- Wallet credit and prize status transition commit atomically.
- Ledger entry references userPrizeId and drawOrderId.

#### STORY-CC-FULFILL-01 — Request fulfillment for physical prize
As a customer, I want to request fulfillment for an owned physical prize so that I can receive it outside the platform.

Acceptance criteria:
- Fulfillment request is available only for owned fulfillable prizes.
- Prize is locked while fulfillment is pending.
- Customer sees request status.
- Admin/support can process or reject with audit trail.

#### STORY-CC-FULFILL-02 — Admin-assisted MVP fulfillment
As an operator, I want a simple fulfillment queue so that we can service physical prize requests before full shipping automation.

Acceptance criteria:
- Queue is vendor-scoped.
- Admin can mark pending, processing, fulfilled, rejected/cancelled.
- Actions write audit logs.
- Customer-visible status updates safely.

### Epic CC-E4 — Support and auditability

#### STORY-CC-SUPPORT-01 — Trace user prize lifecycle
As support, I want to search by user, draw order, proof ID, or user prize ID so that I can resolve disputes.

Acceptance criteria:
- Lookup returns wallet debit/credit, draw order, result, proof, user prize, return/fulfillment events.
- Lookup is role-gated and vendor-scoped.
- Sensitive internal fields are hidden from customer-facing exports.
- Missing records produce safe not-found responses.

#### STORY-CC-SUPPORT-02 — Explain value/grade at draw time
As support, I want to see the value and metadata snapshot shown at draw time so that I can answer disputes about changed valuations.

Acceptance criteria:
- Draw proof/result stores prize metadata snapshot.
- Support can compare current prize metadata vs draw-time snapshot.
- Customer proof page shows stable snapshot values where appropriate.

### Epic CC-E5 — Acquisition mechanics roadmap

#### STORY-CC-VOUCHER-01 — Own a pack before opening
As a customer, I want to receive or buy a pack that I can open later so that gifts, bundles, and promos are possible.

Acceptance criteria:
- Roadmap model defines pack voucher status AVAILABLE, OPENED, EXPIRED, CANCELLED.
- Opening a voucher creates one draw order and marks voucher OPENED atomically.
- Vouchers are user/vendor scoped.
- Not required for immediate MVP paid draw.

#### STORY-CC-FREE-01 — Receive free spin safely
As a new customer, I want a free spin/free pack only if the platform clearly tells me whether it can produce real ownership.

Acceptance criteria:
- Free spin requires eligibility/rate-limit/anti-abuse checks before release.
- Free-demo and real-promo flows are distinct.
- Real promo spin has ledger/source record even if price is zero.
- Demo spin creates no real ownership.

### Epic CC-E6 — Social proof and marketplace readiness

#### STORY-CC-WINNERS-01 — View recent/all winners
As a customer, I want to see recent or high-value winners so that I trust the platform is active.

Acceptance criteria:
- Feed is backed by real draw records.
- User identity is redacted unless policy/consent allows.
- Feed is filterable by vendor/category/pack/value tier if enabled.
- Private inventory does not leak.

#### STORY-CC-MARKET-01 — Preserve future marketplace path
As a product owner, I want the asset model to support future marketplace and transfers so that we do not need a data-model rewrite later.

Acceptance criteria:
- User prize status machine leaves room for LISTED, SOLD, TRANSFERRED, LOCKED.
- MVP UI does not expose unimplemented marketplace actions.
- Future identity linking is modeled separately from canonical user ownership.

### Epic CC-E7 — Vendor/admin operations

#### STORY-CC-ADMIN-01 — Create prize with custody/value metadata
As a vendor operator, I want to create prizes with structured collectible metadata so that customer displays and support records are consistent.

Acceptance criteria:
- Admin can set image, title, grade, year, set, card number, reference value, currency, custody status, fulfillment eligibility.
- Required fields are validated before publish.
- Metadata is vendor-scoped.

#### STORY-CC-ADMIN-02 — Manage asset lifecycle transitions
As an operator, I want to update user prize statuses through approved transitions so that fulfillment, returns, and locks stay auditable.

Acceptance criteria:
- Only allowed transitions are accepted.
- Every transition writes audit log with actor/reason.
- Customer-visible status is derived from internal state.
- Vendor scoping is enforced.

## Recommended Oripa SaaS backlog impact

P0 / MVP-critical:
- UserPrize/owned asset record created atomically with draw.
- Fix authenticated user scoping for wallet/inventory/draw history.
- Support trace from wallet debit to draw/proof/inventory.
- Return-to-points transition and ledger credit.

P1 / near-MVP trust and operations:
- Structured prize metadata.
- Reference value/source snapshot.
- Fulfillment request queue.
- Recent/all winners projection.
- Custody/fulfillment status fields.

P2 / growth:
- Free pack/free spin with anti-abuse.
- Pack vouchers/open-later flow.
- Marketplace-ready list/transfer states.

Roadmap / explicit non-goals for now:
- Privy/web3 wallet login.
- Solana/NFT transfers.
- Moonpay/Coinflow payments.
- Collateralized loans.
- Full marketplace/trading.

# Oripa SaaS CAR Proposal

Source reference: `docs/reference-clove-pokemon-deep-dive.md` from Clove Pokemon Oripa public product analysis.

Purpose: convert the Clove-inspired product findings into customer-facing **Challenge / Action / Result** statements that can guide Oripa SaaS positioning, requirements, roadmap, and acceptance criteria.

## Assumptions

- **CAR means Challenge / Action / Result.**
- The target product is a multi-tenant Oripa SaaS platform for TCG/card mystery packs, initially modeled on Pokemon Oripa behavior.
- The product should copy Clove's successful product shape and trust mechanics, not its exact implementation or every advanced feature on day one.
- MVP must preserve the local repo's existing strengths: vendor scoping, JWT auth for sensitive user endpoints, idempotent draws, wallet ledger, serializable draw transactions, audit/outbox, and fairness proofs.
- Customer-facing language should remain benefit-oriented; internal terms like HMAC, Prisma, and serializable transactions should appear only where trust/compliance audiences need them.

## Integration risks

- **Trust claims must be backed by shipped verification UX.** Do not market provable fairness beyond what the proof API/result page actually lets users verify.
- **Wallet/payment claims require user-scoped auth.** The current wallet endpoint must be fixed before real customer claims about safe account balances.
- **Fulfillment claims require user prize inventory.** Draw result rows alone are not enough for ship/return-to-points flows.
- **Promotion/gate claims create operational burden.** New-user, daily, rank, last-one, round-number, and RUSH mechanics need clear admin controls and abuse prevention.
- **Clove parity is not MVP parity.** RUSH tickets, multi-country fulfillment, HLS video production, Algolia, Statsig, and complex rank systems should be phased.

## Recommended CAR pillars

### 1. Trust & fair draws

**CAR-TRUST-01 — Verifiable draw integrity**

- **Challenge:** Customers hesitate to spend points on mystery packs if they suspect the draw can be manipulated after purchase.
- **Action:** Provide commitment/reveal fairness proofs for every paid draw, backed by immutable draw metadata, pool snapshots, and a public proof lookup.
- **Result:** Customers can independently verify draw integrity, reducing disputes and increasing confidence to participate in higher-value packs.

**CAR-TRUST-02 — Tamper-resistant transaction trail**

- **Challenge:** Operators need to explain exactly what happened when a customer disputes a draw, wallet debit, or prize outcome.
- **Action:** Record draw orders, draw results, wallet ledger entries, fairness selections, audit logs, and outbox events as a connected trace.
- **Result:** Support teams can reconstruct customer events quickly and vendors get a defensible operational history.

**CAR-TRUST-03 — Transparent prize odds without leaking operations too early**

- **Challenge:** Customers need enough lineup/rate transparency to buy confidently, while operators may not want to expose sensitive operational weights pre-draw.
- **Action:** Show customer-facing grade lineups, displayed quantities, remaining pack counts, and published rates, while revealing immutable proof snapshots after draw.
- **Result:** Customers understand the upside before buying, and the platform preserves operational flexibility without weakening fairness evidence.

### 2. Storefront discovery & merchandising

**CAR-DISCOVERY-01 — Category-first shopping**

- **Challenge:** Customers cannot find relevant packs when all products are shown in one flat list.
- **Action:** Organize storefronts by category such as Pokemon, One Piece, Yu-Gi-Oh, Weiss Schwarz, Hobby, Figure, and RUSH.
- **Result:** Customers reach the packs they care about faster, improving browsing depth and conversion.

**CAR-DISCOVERY-02 — Tag-driven pack discovery**

- **Challenge:** Customers shop by intent, not database fields: PSA10, Charizard, BOX, Beginner Only, High Chance Profit, Final Drawer Bonus, and similar hooks.
- **Action:** Add vendor-managed tags with localized labels, badge colors, display order, and category-specific filtering.
- **Result:** Vendors can merchandise campaigns in customer language and customers can filter directly to desired pack types.

**CAR-DISCOVERY-03 — Sorts that match purchase intent**

- **Challenge:** Customers need different sorting paths depending on whether they want recommended, newest, cheapest, expensive, popular, or nearly sold-out packs.
- **Action:** Support storefront sort modes inspired by Clove: recommended, newest, popularity, price ascending/descending, and low remaining rate.
- **Result:** Customers can browse according to intent, and vendors can surface urgent or strategic inventory.

**CAR-DISCOVERY-04 — Campaign rails and new-user surfaces**

- **Challenge:** First-time customers need obvious low-friction offers before committing to premium packs.
- **Action:** Provide campaign banners, recommended rails, and new-user pack sections with explicit eligibility messaging.
- **Result:** New customers get a guided first purchase path and vendors can improve activation without custom frontend work.

### 3. Product detail clarity

**CAR-DETAIL-01 — Prize-grade lineups**

- **Challenge:** Customers struggle to evaluate packs when chase prizes, mid-tier prizes, bonuses, and filler prizes are mixed together.
- **Action:** Display prize lineups by grade: FIRST, SECOND, THIRD, FOURTH, EXTRA, ROUND_NUMBER, and LAST_ONE.
- **Result:** Customers can quickly understand jackpot upside, consolation quality, and special bonus mechanics before drawing.

**CAR-DETAIL-02 — Card-specific prize metadata**

- **Challenge:** TCG buyers care about exact card identity, condition, rarity, card number, image, appraised status, and reference value.
- **Action:** Store and display prize metadata including localized name, sub-description, card code/kataban, condition, image, reference price, appraised flag, and display quantity.
- **Result:** Customers trust prize quality and vendors can sell high-value packs with collector-grade context.

**CAR-DETAIL-03 — Availability and limits upfront**

- **Challenge:** Customers become frustrated if they only discover sold-out status, personal draw limits, release timing, or eligibility restrictions at checkout.
- **Action:** Show remaining stock, total quantity, open/close time, countdowns, max draws per user, daily limits, rank locks, and user-specific gate status on the detail page.
- **Result:** Customers know whether they can draw before attempting purchase, reducing failed checkout moments.

**CAR-DETAIL-04 — Rich draw presentation without blocking MVP**

- **Challenge:** Modern Oripa customers expect draw excitement, but full video/HLS production can slow MVP delivery.
- **Action:** Design the result contract to support videoUrl and animation assets, while initially allowing static/placeholder draw animations.
- **Result:** The platform can launch with a credible draw UX and later upgrade into richer video-backed experiences without rewriting APIs.

### 4. Draw experience & result handling

**CAR-DRAW-01 — Idempotent paid draws**

- **Challenge:** Double-clicks, retries, or mobile network issues can accidentally duplicate charges or draw outcomes.
- **Action:** Require idempotency keys for draw operations and return the same result for repeated requests in the same scope.
- **Result:** Customers avoid accidental duplicate spending and operators reduce refund/support load.

**CAR-DRAW-02 — Clear result grouping**

- **Challenge:** Customers need to understand exactly what they won, especially when normal prizes, bonus prizes, RUSH tickets, last-one rewards, or round-number rewards appear together.
- **Action:** Return draw results grouped into normal prizes, extra prizes, round-number prize, last-one prize, and virtual/RUSH ticket prizes.
- **Result:** Customers can interpret results instantly and the frontend can present outcomes without custom parsing hacks.

**CAR-DRAW-03 — Safe concurrent inventory depletion**

- **Challenge:** Popular packs can receive many draw requests at once, risking oversold pack/prize inventory.
- **Action:** Execute draws in serializable transactions with locked stock updates and draw-result creation in one operation.
- **Result:** Customers receive valid outcomes and vendors avoid impossible fulfillment promises.

**CAR-DRAW-04 — Demo gacha for confidence building**

- **Challenge:** New customers may want to understand pack feel before risking points.
- **Action:** Offer optional demo gacha results using displayed prize data without consuming wallet balance or real inventory.
- **Result:** Customers learn the experience safely, improving trust and first-purchase readiness.

### 5. Wallet, payments & point economy

**CAR-WALLET-01 — User-scoped wallet safety**

- **Challenge:** Customers expect their point balance and ledger to be private and isolated from other users and vendors.
- **Action:** Enforce JWT-authenticated user scope plus vendor scope on wallet, draw, payment, and fulfillment endpoints.
- **Result:** Customers see only their own balances and transactions, protecting funds and tenant isolation.

**CAR-WALLET-02 — Immutable point ledger**

- **Challenge:** Point balances are hard to audit if the platform only stores mutable balances.
- **Action:** Maintain wallet accounts with immutable ledger entries for top-ups, draws, refunds, returns-to-points, adjustments, and promotions.
- **Result:** Customers and operators can trace every balance movement and resolve disputes accurately.

**CAR-WALLET-03 — Multiple top-up paths**

- **Challenge:** Different markets prefer different payment rails, and failed payment UX can block conversion.
- **Action:** Design payment abstractions that can support Stripe Checkout first, with PayPay/GMO-style providers later.
- **Result:** The platform can launch with a simple payment path while preserving room for regional payment expansion.

**CAR-WALLET-04 — Coupons and promotion codes**

- **Challenge:** Vendors need acquisition and retention offers without manual balance edits.
- **Action:** Support promotion codes, point coupons, signup credits, and campaign-specific discounts as ledger-backed events.
- **Result:** Vendors can run campaigns safely and customers get transparent promotional value.

### 6. Prize ownership & fulfillment

**CAR-FULFILL-01 — User prize inventory**

- **Challenge:** After a draw, customers need a durable place to manage owned prizes before shipping or converting them.
- **Action:** Create user prize inventory records from draw outcomes, linked to prize metadata, draw order, vendor, and fulfillment status.
- **Result:** Customers can review, consolidate, ship, or return prizes later instead of relying on transient result pages.

**CAR-FULFILL-02 — Ship or convert-to-points choice**

- **Challenge:** Not every customer wants every physical prize shipped, especially low-value or duplicate cards.
- **Action:** Let customers choose between shipping eligible prizes or converting eligible prizes back to points using a displayed return amount.
- **Result:** Customers get flexible post-draw value and vendors reduce unnecessary fulfillment costs.

**CAR-FULFILL-03 — Fulfillment location transparency**

- **Challenge:** International customers need to know whether prizes ship from Japan, Hong Kong, local warehouses, or are virtual-only.
- **Action:** Store and display prize location metadata such as JAPAN, HONG_KONG, and VIRTUAL, plus shipping-only flags.
- **Result:** Customers understand shipping expectations and operators can route fulfillment correctly.

**CAR-FULFILL-04 — Address and shipping status management**

- **Challenge:** Shipping workflows fail when addresses, selected prizes, shipping fees, and status are not connected.
- **Action:** Add address CRUD, default address selection, shipping request creation, and fulfillment status tracking.
- **Result:** Customers can complete prize redemption self-serve and operators get a manageable fulfillment queue.

### 7. Promotions, gates & retention mechanics

**CAR-GATE-01 — New-user gated packs**

- **Challenge:** New customers need controlled introductory offers that do not remain exploitable forever.
- **Action:** Add new-user pack gates with days-after-registration, buy amount limit, and max draws per user.
- **Result:** Vendors can offer compelling onboarding packs while limiting abuse and exposure.

**CAR-GATE-02 — Daily limited packs**

- **Challenge:** Customers need a reason to return, and vendors need repeat engagement mechanics.
- **Action:** Support daily draw gates and visible once-per-day eligibility state.
- **Result:** Customers form return habits and vendors increase daily active usage.

**CAR-GATE-03 — Rank-limited packs**

- **Challenge:** High-value or loyalty packs should reward engaged customers without exposing them to everyone.
- **Action:** Add rank names and rank-gated pack eligibility, while deferring complex rank progression until after MVP.
- **Result:** Vendors can create loyalty tiers and customers get aspirational unlocks.

**CAR-GATE-04 — Last-one and round-number bonuses**

- **Challenge:** Packs need urgency mechanics that encourage final draws and milestone participation.
- **Action:** Support last-one prize and round-number prize definitions, result grouping, and eligibility checks.
- **Result:** Customers understand bonus opportunities and vendors can increase sell-through on remaining inventory.

**CAR-GATE-05 — Extra prize thresholds**

- **Challenge:** Customers need incentives to buy larger draw quantities without hiding the bonus logic.
- **Action:** Add extra prize threshold configuration and visible bonus rates/conditions.
- **Result:** Customers see why larger purchases matter, and vendors can improve average order value transparently.

**CAR-GATE-06 — RUSH tickets as a later virtual loop**

- **Challenge:** Advanced retention loops can add engagement but complicate inventory, fairness, and UX.
- **Action:** Treat RUSH tickets as virtual prizes with dedicated inventory and consumption APIs, but defer full implementation until base draw/fulfillment is stable.
- **Result:** The roadmap preserves Clove-style expansion potential without overloading MVP scope.

### 8. Vendor multi-tenancy & admin operations

**CAR-TENANT-01 — Branded vendor storefronts**

- **Challenge:** Multiple Oripa operators need separate storefronts without separate codebases.
- **Action:** Resolve vendors by host or `x-vendor-host`, and scope packs, banners, tags, wallets, orders, and settings by vendor.
- **Result:** Each vendor gets an isolated branded storefront while the platform runs from one shared SaaS codebase.

**CAR-TENANT-02 — Least-privilege admin access**

- **Challenge:** Vendor staff should manage only their own tenant data, while platform admins retain cross-tenant oversight.
- **Action:** Preserve role and membership checks for vendor management, pack creation, banners, limits, and future fulfillment/admin tools.
- **Result:** Operators can delegate work safely without cross-tenant data leakage.

**CAR-TENANT-03 — Pack/prize CMS for non-engineers**

- **Challenge:** Vendors need to launch and update packs quickly without database edits or developer intervention.
- **Action:** Provide admin CRUD for categories, tags, banners, packs, prize lineups, publish status, gate settings, and display metadata.
- **Result:** Vendors can operate campaigns independently and reduce launch turnaround time.

**CAR-TENANT-04 — Operational traceability for finance and support**

- **Challenge:** Operators need tenant revenue, fees, wallet movements, payment transactions, and disputes tied together.
- **Action:** Connect tenant revenue ledger, fee charges, payment transactions, wallet entries, draw orders, audit logs, and outbox events.
- **Result:** Finance/support teams can reconcile activity and vendors gain confidence in platform reporting.

### 9. Customer account & communication

**CAR-ACCOUNT-01 — Low-friction signup with verification path**

- **Challenge:** Customers want fast onboarding, but the platform needs verified channels for payments, shipping, and fraud control.
- **Action:** Support JWT-authenticated accounts with optional email, phone, and social/OAuth verification flows over time.
- **Result:** Customers can start quickly while the platform gains stronger identity assurance for sensitive actions.

**CAR-ACCOUNT-02 — Notification readiness**

- **Challenge:** Customers need timely updates for prize wins, shipping, payment status, promotions, and expiring offers.
- **Action:** Model notification events through the existing outbox pattern before adding delivery channels.
- **Result:** The platform can add email/SMS/push/Telegram-style delivery later without rewriting business events.

## MVP CAR set to apply first

Apply these first because they map to existing architecture and unlock a credible customer product without overbuilding:

1. CAR-TRUST-01 — Verifiable draw integrity.
2. CAR-TRUST-02 — Tamper-resistant transaction trail.
3. CAR-DISCOVERY-01 — Category-first shopping.
4. CAR-DISCOVERY-02 — Tag-driven pack discovery.
5. CAR-DETAIL-01 — Prize-grade lineups.
6. CAR-DETAIL-02 — Card-specific prize metadata.
7. CAR-DRAW-01 — Idempotent paid draws.
8. CAR-DRAW-02 — Clear result grouping.
9. CAR-DRAW-03 — Safe concurrent inventory depletion.
10. CAR-WALLET-01 — User-scoped wallet safety.
11. CAR-WALLET-02 — Immutable point ledger.
12. CAR-FULFILL-01 — User prize inventory.
13. CAR-FULFILL-02 — Ship or convert-to-points choice.
14. CAR-TENANT-01 — Branded vendor storefronts.
15. CAR-TENANT-03 — Pack/prize CMS for non-engineers.

## Deferred CARs

Defer these until the core draw, inventory, wallet, storefront, and fulfillment loops are stable:

- CAR-DRAW-04 — Demo gacha.
- CAR-WALLET-03 — Multiple top-up paths beyond first provider.
- CAR-WALLET-04 — Coupons and promotion codes.
- CAR-FULFILL-03 — Multi-location fulfillment beyond basic metadata.
- CAR-FULFILL-04 — Advanced shipping status management.
- CAR-GATE-01 — New-user gated packs.
- CAR-GATE-02 — Daily limited packs.
- CAR-GATE-03 — Rank-limited packs.
- CAR-GATE-04 — Last-one and round-number bonuses.
- CAR-GATE-05 — Extra prize thresholds.
- CAR-GATE-06 — RUSH tickets.
- CAR-ACCOUNT-02 — Notification delivery beyond event modeling.

## CAR-to-implementation mapping

### Phase 0 — Safety fixes

- CAR-WALLET-01: Fix wallet reads to require authenticated user scope plus vendor scope.
- CAR-DRAW-03: Re-check concurrent stock locking behavior under load.
- CAR-TRUST-01: Ensure proof lookup can support customer-facing verification copy.

### Phase 1 — Storefront and product model

- CAR-DISCOVERY-01/02/03: Add category, tags, sort metadata, and storefront list endpoints.
- CAR-DETAIL-01/02/03: Extend prize metadata and detail endpoint response.

### Phase 2 — Draw result and prize ownership

- CAR-DRAW-01/02/03: Keep existing idempotent draw architecture but return Clove-shaped result groups.
- CAR-FULFILL-01: Create user prize inventory during successful draw transaction.
- CAR-FULFILL-02: Add return-to-points action after inventory exists.

### Phase 3 — Admin and vendor operations

- CAR-TENANT-01/02/03: Add admin CRUD surfaces for tags, packs, prize lineups, banners, and gates.
- CAR-TENANT-04: Expand reporting/reconciliation around existing ledger and audit trail.

### Phase 4 — Growth mechanics

- CAR-GATE-01 through CAR-GATE-06: Add gates and special mechanics one by one after base flows are tested.
- CAR-WALLET-04 and CAR-ACCOUNT-02: Add promotion and notification delivery once event modeling is stable.

## Proposed customer-facing summary

Oripa SaaS helps vendors launch branded, trustworthy TCG mystery-pack storefronts with verifiable draws, clear prize lineups, wallet-backed point purchases, and post-draw prize management. Customers can browse by category and collector intent, understand chase prizes before drawing, verify paid outcomes, and choose whether to ship or convert eligible prizes. Vendors get a reusable multi-tenant platform for merchandising, campaign launches, inventory control, and support traceability without rebuilding core Oripa infrastructure for every storefront.

## Open decisions before implementation

1. **Public proof depth:** Should customers see full pool snapshots immediately after each draw, or only a verification hash plus revealed seed?
2. **Prize odds display:** Should pre-draw pages show exact odds per prize, grade-level rates only, or displayed lineup without exact operational weights?
3. **Initial payment provider:** Should MVP ship with wallet seed/manual top-up only, Stripe first, or Stripe plus local payment roadmap?
4. **Fulfillment MVP:** Should MVP support only return-to-points first, or full ship-request creation from day one?
5. **Admin scope:** Should first CMS target platform admin only, or vendor staff admin from the first release?

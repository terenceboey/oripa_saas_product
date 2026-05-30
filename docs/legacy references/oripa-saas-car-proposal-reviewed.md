# Oripa SaaS CAR Proposal — Oracle Reviewed

Source docs:
- `docs/reference-clove-pokemon-deep-dive.md`
- `docs/oripa-saas-car-proposal.md`
- Oracle review artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260528T154511Z_oripa-saas-car-review/oracle_response.md`

Oracle decision: **conditional approve**. The CAR taxonomy is strong as a roadmap, but MVP should be tightened to avoid overclaiming before proof UX, wallet funding, user prize inventory, fulfillment, CMS, and wallet auth fixes are shipped.

## Final recommendation

Use the CAR statements as a **roadmap taxonomy**, but apply a narrower MVP CAR set around this customer loop:

`browse pack → view lineup/limits → top up or seeded wallet → authenticated draw → idempotent fair result → user prize inventory → proof lookup → return-to-points or admin-assisted fulfillment`

Do **not** market shipping, multiple payment providers, promotions, RUSH, rank systems, full vendor self-service CMS, or branded/theme customization until those features exist.

## MVP CAR statements to apply first

### CAR-WALLET-01 — User-scoped wallet safety

- **Challenge:** Customers expect their point balance and ledger to be private and isolated from other users and vendors.
- **Action:** Enforce JWT-authenticated user scope plus vendor scope on wallet, draw, payment, and fulfillment endpoints.
- **Result:** Customers see only their own balances and transactions, protecting funds and tenant isolation.

### CAR-WALLET-02 — Immutable point ledger

- **Challenge:** Point balances are hard to audit if the platform only stores mutable balances.
- **Action:** Maintain wallet accounts with immutable ledger entries for top-ups, draws, refunds, returns-to-points, adjustments, and promotions.
- **Result:** Customers and operators can trace every balance movement and resolve disputes accurately.

### CAR-WALLET-03A — First funded-wallet path

- **Challenge:** Customers cannot draw unless they have a reliable way to receive or purchase points.
- **Action:** Support one launch-safe funding path: Stripe Checkout, admin/manual credit for pilot users, or another explicitly chosen provider.
- **Result:** Customers can enter the paid draw loop without hidden manual operations.

### CAR-TRUST-01 — Verifiable draw integrity

- **Challenge:** Customers hesitate to spend points on mystery packs if they suspect the draw can be manipulated after purchase.
- **Action:** Provide commitment/reveal fairness proofs for every paid draw, backed by immutable draw metadata, pool snapshots, and a customer-readable proof lookup/result page.
- **Result:** Customers can independently verify draw integrity, reducing disputes and increasing confidence to participate in higher-value packs.

### CAR-TRUST-02 — Tamper-resistant transaction trail

- **Challenge:** Operators need to explain exactly what happened when a customer disputes a draw, wallet debit, or prize outcome.
- **Action:** Record draw orders, draw results, wallet ledger entries, fairness selections, audit logs, and outbox events as a connected trace.
- **Result:** Support teams can reconstruct customer events quickly and vendors get a defensible operational history.

### CAR-DRAW-01 — Idempotent paid draws

- **Challenge:** Double-clicks, retries, or mobile network issues can accidentally duplicate charges or draw outcomes.
- **Action:** Require idempotency keys for draw operations and return the same result for repeated requests in the same scope.
- **Result:** Customers avoid accidental duplicate spending and operators reduce refund/support load.

### CAR-DRAW-03 — Safe concurrent inventory depletion

- **Challenge:** Popular packs can receive many draw requests at once, risking oversold pack/prize inventory.
- **Action:** Execute draws in serializable transactions with stock updates, wallet debits, and draw-result creation in one operation; verify with concurrency tests before public claims.
- **Result:** Customers receive valid outcomes and vendors reduce impossible fulfillment promises.

### CAR-DISCOVERY-01 — Category-first shopping

- **Challenge:** Customers cannot find relevant packs when all products are shown in one flat list.
- **Action:** Organize storefronts by category such as Pokemon, One Piece, Yu-Gi-Oh, Weiss Schwarz, Hobby, Figure, and RUSH.
- **Result:** Customers reach the packs they care about faster, improving browsing depth and conversion.

### CAR-DISCOVERY-02 — Tag-driven pack discovery

- **Challenge:** Customers shop by intent, not database fields: PSA10, Charizard, BOX, Beginner Only, High Chance Profit, Final Drawer Bonus, and similar hooks.
- **Action:** Add vendor-managed tags with localized labels, badge colors, display order, and category-specific filtering.
- **Result:** Vendors can merchandise campaigns in customer language and customers can filter directly to desired pack types.

### CAR-DISCOVERY-03 — Basic purchase-intent sorts

- **Challenge:** Customers need different sorting paths depending on whether they want new, cheap, premium, popular, or nearly sold-out packs.
- **Action:** Support basic storefront sort modes: newest, price ascending/descending, recommended, and remaining/near-sold-out where data exists.
- **Result:** Customers can browse according to intent, and vendors can surface urgent or strategic inventory.

### CAR-DETAIL-01 — Prize-grade lineups

- **Challenge:** Customers struggle to evaluate packs when chase prizes, mid-tier prizes, bonuses, and filler prizes are mixed together.
- **Action:** Display prize lineups by grade: FIRST, SECOND, THIRD, FOURTH, EXTRA, ROUND_NUMBER, and LAST_ONE where supported.
- **Result:** Customers can quickly understand jackpot upside, consolation quality, and special bonus mechanics before drawing.

### CAR-DETAIL-02 — Card-specific prize metadata

- **Challenge:** TCG buyers care about exact card identity, condition, rarity, card number, image, appraised status, and reference value.
- **Action:** Store and display prize metadata including localized name, sub-description, card code/kataban, condition, image, reference price, appraised flag, and display quantity.
- **Result:** Customers trust prize quality and vendors can sell high-value packs with collector-grade context.

### CAR-DETAIL-03 — Availability and limits upfront

- **Challenge:** Customers become frustrated if they only discover sold-out status, personal draw limits, release timing, or eligibility restrictions at checkout.
- **Action:** Show remaining stock, total quantity, open/close time, countdowns, max draws per user, and eligibility status on the list/detail pages.
- **Result:** Customers know whether they can draw before attempting purchase, reducing failed checkout moments.

### CAR-ELIGIBILITY-01 — Consistent draw eligibility

- **Challenge:** Customers lose trust when the storefront says they can draw but checkout rejects them, or when restricted packs are inconsistently enforced.
- **Action:** Centralize eligibility checks for stock, open/close windows, per-user limits, daily/new-user/rank gates, user allowlists, and auth state; expose the same decision to list, detail, and draw APIs.
- **Result:** Customers see accurate availability before spending effort, and operators avoid inconsistent gate enforcement.

### CAR-FULFILL-01 — User prize inventory

- **Challenge:** After a draw, customers need a durable place to manage owned prizes before shipping or converting them.
- **Action:** Create user prize inventory records from draw outcomes, linked to prize metadata, draw order, vendor, and fulfillment status.
- **Result:** Customers can review, consolidate, return, or later ship prizes instead of relying on transient result pages.

### CAR-FULFILL-02A — Convert eligible prizes to points

- **Challenge:** Not every customer wants every physical prize, especially low-value or duplicate cards.
- **Action:** Let customers convert eligible owned prizes back to points using a displayed return amount and immutable wallet ledger entry.
- **Result:** Customers get flexible post-draw value and vendors reduce unnecessary fulfillment burden.

### CAR-TENANT-01 — Vendor-scoped storefronts

- **Challenge:** Multiple Oripa operators need separate storefronts without separate codebases.
- **Action:** Resolve vendors by host or `x-vendor-host`, and scope packs, banners, tags, wallets, orders, and settings by vendor.
- **Result:** Each vendor gets an isolated storefront while the platform runs from one shared SaaS codebase.

### CAR-TENANT-02 — Minimal least-privilege admin access

- **Challenge:** Admin tools can become a cross-tenant data leakage risk if access control is bolted on later.
- **Action:** Enforce platform-admin versus vendor-staff boundaries for pack, prize, banner, wallet, support, and fulfillment actions from the first admin workflow.
- **Result:** Operators can delegate work safely without cross-tenant data exposure.

### CAR-TENANT-03A — Platform-admin pack/prize CMS or import workflow

- **Challenge:** Vendors need packs created reliably, but full vendor self-service CMS may be too heavy for the first release.
- **Action:** Provide a platform-admin pack/prize creation or structured import workflow before building full vendor-facing CMS.
- **Result:** The product can launch real packs with controlled operations while preserving the path to vendor self-service.

### CAR-ADMIN-01 — Safe pack publishing validation

- **Challenge:** Vendors can accidentally publish packs with broken images, missing prize metadata, impossible stock, invalid odds, or missing return amounts.
- **Action:** Validate pack configuration before publish, including prize stock, displayed quantities, grade lineups, required images, return amounts, timing, and proof-snapshot eligibility.
- **Result:** Vendors reduce launch mistakes and customers see complete, trustworthy pack pages.

### CAR-SUPPORT-01 — Draw and wallet dispute lookup

- **Challenge:** Support teams need fast answers when customers ask about a draw, wallet debit, refund, or prize status.
- **Action:** Provide internal lookup by user, draw order, wallet entry, prize, and proof ID, showing the connected event trail.
- **Result:** Support can resolve disputes quickly without engineering database access.

### CAR-SECURITY-01 — Abuse-resistant draw and promotion controls

- **Challenge:** High-value packs and promotional mechanics can be exploited through duplicate accounts, retries, scripted draws, or coupon abuse.
- **Action:** Apply rate limits, idempotency scope checks, user eligibility records, audit logging, and admin-visible abuse signals.
- **Result:** Vendors can run attractive offers without uncontrolled financial exposure.

### CAR-OPS-01 — Operational failure visibility

- **Challenge:** Operators need to know when payments, draws, proof generation, wallet ledger writes, outbox delivery, or fulfillment jobs fail.
- **Action:** Track operational states, retries, dead-letter events, and reconciliation mismatches.
- **Result:** Teams can catch failures before they become customer disputes.

## Roadmap CARs, not MVP claims

Keep these as roadmap statements, not MVP promises:

- **CAR-DRAW-04 — Demo gacha:** useful, but clearly label as illustrative/non-real and defer until real draw loop is stable.
- **CAR-WALLET-03 — Multiple top-up paths:** defer PayPay/GMO-style expansion; start with one funding path.
- **CAR-WALLET-04 — Coupons and promotion codes:** defer until abuse controls and ledger semantics are settled.
- **CAR-FULFILL-03 — Fulfillment location transparency:** model metadata early, but avoid claims about multi-country fulfillment routing/fees until built.
- **CAR-FULFILL-04 — Self-serve shipping request workflow:** only claim once address CRUD, selected prize shipping, fees, and status exist.
- **CAR-GATE-01 — New-user gated packs:** defer beyond basic per-user limits unless explicitly prioritized.
- **CAR-GATE-02 — Daily limited packs:** defer until centralized eligibility exists.
- **CAR-GATE-03 — Rank-limited packs:** phrase as manual/admin-assigned rank gates until rank progression exists.
- **CAR-GATE-04 — Last-one and round-number bonuses:** defer active customer claims; keep API contract extensible.
- **CAR-GATE-05 — Extra prize thresholds:** defer until base draw and result grouping are stable.
- **CAR-GATE-06 — RUSH tickets:** later virtual-prize loop, not MVP.
- **CAR-COMPLIANCE-01 — Market and content eligibility controls:** model as product-control roadmap; do not treat as legal compliance coverage.
- **CAR-ACCOUNT-02 — Notification delivery:** event readiness is not delivery; do not claim email/SMS/push until shipped.

## Suggested customer-facing summary

Use this conservative wording until implementation catches up:

> Oripa SaaS helps operators launch vendor-scoped TCG mystery-pack storefronts with clear prize lineups, authenticated wallet-backed draws, idempotent purchase protection, post-draw prize ownership, and customer-verifiable fairness records. Customers can browse by category and collector intent, review prize tiers and availability before drawing, see clear draw results, and manage eligible prizes after the draw. Vendors get reusable tools for pack merchandising, inventory control, auditability, and support traceability without rebuilding the core Oripa infrastructure for each storefront.

Only add **shipping**, **payment providers**, **promotions**, **RUSH**, **rank**, or **branded storefront/theme customization** after those features are implemented and verified.

## Implementation order implied by CARs

1. Fix wallet auth/user scope.
2. Confirm or add first funded-wallet path: Stripe or pilot manual credit.
3. Add/customer-proof proof lookup UX and plain-English verification steps.
4. Add category/tag/sort storefront model and APIs.
5. Add prize-grade and collector metadata.
6. Add centralized eligibility service for list/detail/draw.
7. Add user prize inventory creation inside successful draw transaction.
8. Add convert-to-points for eligible owned prizes.
9. Add minimal admin/import workflow with safe publish validation.
10. Add support lookup and operational failure visibility.
11. Only then add shipping self-service, promotions, special gates, and RUSH mechanics.

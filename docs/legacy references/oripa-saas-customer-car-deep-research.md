# Oripa SaaS Customer CAR Deep Research

Capture time: 2026-05-28T15:56:57Z UTC

Purpose: consolidate Clove reverse-engineering, local `oripa_saas` repo inspection, competitor/customer trust research, and Oracle review into customer-facing **Challenge / Action / Result** statements that can guide MVP scope, website copy, acceptance criteria, and handoff to `@HRMcodingbot`.

Assumption: **CAR = Challenge / Action / Result**.

## Bottom line

The strongest customer promise for `oripa_saas` is not “we clone Clove.” It is:

> A trustworthy TCG mystery-pack storefront where customers can understand a pack before spending, draw without accidental duplicate charges, verify the fairness record after the result, and manage owned prizes through a transparent wallet/prize ledger.

Use customer CAR statements as a **scope-control tool**. Every customer-facing promise should map to a shipped feature, API, UI, and test. The Oracle review is correct: keep the broad CAR taxonomy as roadmap, but launch with a tighter loop:

`browse pack → view lineup/limits → fund or seed wallet → authenticated idempotent draw → clear result → user prize inventory → proof lookup → convert eligible prize to points or admin-assisted fulfillment`

Do **not** market full shipping automation, multiple payment rails, coupons, RUSH, rank progression, live video, or vendor self-serve SaaS branding until the code actually supports those.

## Evidence sources used

### Local project evidence

- `docs/reference-clove-pokemon-deep-dive.md`
- `docs/oripa-saas-car-proposal.md`
- `docs/oripa-saas-car-proposal-reviewed.md`
- `docs/oripa-saas-customer-stories-proposal.md`
- `prisma/schema.prisma`
- `apps/api/src/modules/packs/router.ts`
- `apps/api/src/modules/draws/router.ts`
- `apps/api/src/modules/wallet/router.ts`

### Oracle evidence

- Existing Oracle review artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260528T154511Z_oripa-saas-car-review/oracle_response.md`
- Verdict from that artifact: **conditional approve**. The CAR framework is strategically strong, but MVP must be narrowed to avoid overclaiming before proof UX, wallet funding, user prize inventory, fulfillment, CMS, and wallet auth fixes are shipped.
- Fresh Oracle invocation was attempted from the research profile, but no durable Oracle session/result was produced, so this report does **not** invent a second Oracle verdict.

### Reference product / market evidence

- Clove public reference: Next.js + GraphQL Oripa storefront; Pokemon catalog showed 146 packs, 10 new-user packs, price range from 5 to 250,000 points, and tags such as High Chance Profit, PSA10 Guaranteed, BOX, Beginner Only, Charizard, Umbreon, Gengar.
- Arena Club Slab Packs public guide: emphasizes digital opening, tiered packs, full odds disclosure, instant reveal, online showroom, and optional physical delivery.
- Courtyard homepage: emphasizes “Digital Packs, Physical Cards. Vaulted and insured,” live “Just Pulled” social proof, digital reveals, and physical asset redemption/vaulting.
- Whatnot Surprise Sets Policy and Buyer Protection Policy: emphasizes rules around mystery/surprise sales, buyer protection, and customer trust boundaries.
- Apple App Store Clove listing: frames Clove as TCG mystery packs / online Oripa, instant reveal, and physical shipment/redemption experience.
- FTC loot box workshop staff perspective and gacha/loot-box commentary: probability disclosure, consumer confusion, minors/age, monetary value, chance mechanics, and gambling-adjacent perception are recurring risk areas.

## Market/customer research synthesis

### What customers actually worry about

1. **“Is the draw rigged?”**
   Mystery-pack customers tolerate randomness, but not opaque manipulation. The highest-leverage trust feature is a customer-readable proof record: seed commitment, revealed seed, pool snapshot hash, selection ranges, and plain-English verification.

2. **“What am I even buying?”**
   Customers need visible prize lineups, tiers, card names, conditions, images, quantities, and remaining stock. Clove-style tags work because customers shop by intent: PSA10, Charizard, BOX, beginner-only, high-chance-profit, last-one bonus.

3. **“Will I be charged twice?”**
   Mobile retries, double clicks, and failed network calls are common. Idempotency is customer-facing even if implemented as backend plumbing.

4. **“Can they actually fulfill the prize?”**
   The draw result must become durable user prize inventory. If the platform only creates transient result rows, it cannot honestly claim post-draw prize management.

5. **“Can I get value from non-chase wins?”**
   Convert-to-points is a critical Oripa mechanic because it reduces friction around duplicates and low-value physical items.

6. **“Can I understand my balance?”**
   Wallet ledgers matter. Customers will ask why points changed; support needs append-only entries for top-ups, draw debits, returns, refunds, and admin adjustments.

7. **“Is this legal/safe/age-appropriate?”**
   Mystery packs are chance products. The product needs age/region/content controls, probability/lineup disclosure decisions, terms, and careful wording. This report is not legal advice, but product controls should be designed early.

8. **“Can support explain disputes?”**
   Trust features that only engineers can query do not reduce support pain. Need draw/wallet/proof lookup for support/admin users.

## Competitive positioning lessons

### Clove

Best reference for Oripa storefront UX. Key customer-facing patterns:

- Category tabs and pack grids.
- Tags/badges in collector language.
- New-user and limited packs.
- Price/remaining stock urgency.
- Detailed prize pages grouped by grade/bonus type.
- Point wallet, payment providers, draw APIs, prize shipping/convert-to-points lifecycle.

Implication for `oripa_saas`: copy the product *shape* and trust mechanics, not necessarily all advanced mechanics on day one.

### Arena Club

Best reference for transparent slab-pack framing:

- Explains tiers such as Grail, Chase, Tier 1/2/3.
- Explicitly says hit rate / odds help users understand expectations.
- Offers digital reveal and option to keep online or request delivery.

Implication: customer copy should explain tiers/rates plainly and avoid hiding what each pack is optimized for.

### Courtyard

Best reference for custody/vaulting and social proof:

- “Digital Packs, Physical Cards. Vaulted and insured.”
- “Just Pulled” live feed creates recency and legitimacy.
- Digital asset experience connects to physical redemption.

Implication: if `oripa_saas` wants custody/vaulting claims, it must implement operational custody metadata and fulfillment tracking. Until then, use weaker wording: “owned prize inventory” and “admin-assisted fulfillment.”

### Whatnot / surprise-sale policies

Best reference for marketplace trust guardrails:

- Surprise products need policy boundaries.
- Buyer protection and clear item/shipping/payment rules reduce dispute risk.

Implication: Oripa SaaS should have explicit pack publish validation, restricted mechanics, and customer-visible terms before broad launch.

## Local repo reality check

### Strengths already present or partly present

- Express API + Prisma + Next.js web monorepo shape.
- Vendor scoping middleware and `vendorId` use.
- Draw API requires JWT auth.
- Draw API requires `x-idempotency-key`.
- Draw transaction uses Prisma serializable transaction.
- Draw API creates draw order, draw result, fairness proof, fairness selections, wallet debit, vendor revenue ledger, audit log, outbox event.
- Proof endpoint exists with plain-English `howToVerify` steps.
- Pack API computes displayed drop-rate percentages from weights.
- Pack creation supports tier-derived prizes and max item limits.

### MVP blockers / gaps

1. **Wallet read endpoint is not user-scoped.**
   `apps/api/src/modules/wallet/router.ts` currently finds first wallet by vendor only: `where: { vendorId: req.vendorId }`. This is a critical privacy/funds blocker. It must require JWT user identity and filter by `{ vendorId, userId }` before any wallet claim.

2. **Proof UX exists at API level but needs customer page.**
   `GET /v1/draws/:drawOrderId/proof` returns verification data. Need a web page that explains it and links from result history.

3. **User prize inventory is not confirmed as complete customer flow.**
   Draw results exist, but customer-manageable inventory/return/shipping state must be explicit before “manage prizes” is promised.

4. **Funding path must be decided.**
   If Stripe/manual credit is not live, copy must avoid “buy points now.”

5. **Category/tag/search/sort need Clove-like storefront modeling.**
   Current pack list is basic newest order; Clove uses category, tags, multiple sorts, campaigns, and new-user rails.

6. **Eligibility needs one source of truth.**
   Sold out, timing, max draw quantity, auth, per-user limits, new-user/daily/rank gates must not be implemented separately in list/detail/draw.

7. **Admin publish validation is launch-critical.**
   Broken prize data creates customer disputes immediately.

## Customer CAR statements — recommended launch set

### CAR-01 — Trustworthy draw integrity

- **Challenge:** Customers hesitate to spend points when they suspect a mystery-pack draw can be changed after purchase.
- **Action:** Commit to a draw seed before selection, reveal the seed after the draw, store the pool snapshot hash and selection ranges, and show a customer-readable proof page.
- **Result:** Customers can verify that their result matches the committed randomness and published draw state, reducing rigging concerns and support disputes.
- **MVP acceptance:** Proof API + web proof page + result-page link + no missing seed/snapshot fields.
- **Copy-safe claim:** “Every paid draw includes a verifiable fairness record.”
- **Do not claim yet:** “Audited,” “certified fair,” or “impossible to manipulate” unless externally audited.

### CAR-02 — No accidental duplicate spending

- **Challenge:** Customers may double-click, refresh, or retry on unstable mobile networks and fear being charged twice.
- **Action:** Require idempotency keys on draw requests and return the original draw result for safe retries within the same user/vendor scope.
- **Result:** Customers pay once for one intended draw action, and support gets fewer refund disputes.
- **MVP acceptance:** Duplicate request test returns same draw order/result; conflicting replay is rejected; wallet debit created once.
- **Copy-safe claim:** “Retries won’t create duplicate draw charges.”

### CAR-03 — Clear pack value before purchase

- **Challenge:** Customers cannot judge a mystery pack if prize tiers, quantities, conditions, and expected value signals are unclear.
- **Action:** Show prize groups, card images, card names, conditions, reference values where available, displayed quantities, drop-rate policy, and remaining stock before draw.
- **Result:** Customers can decide whether the pack matches their risk budget and collector goals.
- **MVP acceptance:** Pack detail page renders grade groups and metadata; missing optional fields fail gracefully.
- **Copy-safe claim:** “See the prize lineup before you draw.”

### CAR-04 — Fast discovery by collector intent

- **Challenge:** Customers do not browse TCG products like raw database rows; they search for themes such as PSA10, Charizard, BOX, low entry price, high upside, or beginner-only.
- **Action:** Add categories, vendor-scoped tags, badge labels, price/remaining filters, and purchase-intent sorts.
- **Result:** Customers find relevant packs faster, and vendors can merchandise campaigns in customer language.
- **MVP acceptance:** Category + tags + newest/price sort; near-sold-out if data exists.
- **Copy-safe claim:** “Browse by category, price, and collector tags.”

### CAR-05 — Accurate availability and eligibility

- **Challenge:** Customers lose trust when a page says a pack is available but checkout rejects it as sold out, closed, or restricted.
- **Action:** Centralize eligibility checks for stock, timing, auth, per-user limits, and future gates, and expose the same reason codes to list/detail/draw APIs.
- **Result:** Customers know whether they can draw before committing attention or points.
- **MVP acceptance:** Reason codes such as `AVAILABLE`, `SOLD_OUT`, `BEFORE_RELEASE`, `ENDED`, `AUTH_REQUIRED`, `LIMIT_REACHED`.
- **Copy-safe claim:** “Availability and limits are shown before you draw.”

### CAR-06 — Private, explainable point wallet

- **Challenge:** Customers will not trust a point economy if they cannot see where points went or if another user’s balance can leak.
- **Action:** Scope wallet APIs by authenticated user and vendor; record immutable ledger entries for credits, debits, returns, refunds, and adjustments.
- **Result:** Customers can understand their balance and support can resolve disputes without database surgery.
- **MVP acceptance:** Wallet route fixed to require auth; user A cannot read user B wallet; append-only ledger shown in account UI.
- **Copy-safe claim:** “Your point balance is private and ledger-backed.”
- **Current status:** Blocked by wallet route bug until fixed.

### CAR-07 — One honest funding path

- **Challenge:** Customers cannot draw if they do not have a clear way to receive or purchase points.
- **Action:** Launch with exactly one explicit funding path: Stripe Checkout, pilot manual credits, or another selected provider. Record all credits in the ledger.
- **Result:** The customer draw loop is real, not dependent on hidden manual operations.
- **MVP acceptance:** Chosen funding path creates wallet ledger credits and handles failed/expired states.
- **Copy-safe claim depends on choice:**
  - Stripe live: “Add points securely with card checkout.”
  - Pilot only: “Pilot accounts receive test credits; payments are not live yet.”

### CAR-08 — Durable owned-prize inventory

- **Challenge:** Customers need to find and manage wins after they leave the result animation.
- **Action:** Create user prize inventory records for every fulfilled draw outcome, linked to draw order, prize metadata, vendor, and status.
- **Result:** Customers can review owned prizes, choose next actions, and build trust that wins are not transient UI events.
- **MVP acceptance:** Result refresh survives; account inventory page shows won prizes; status cannot be lost.
- **Copy-safe claim:** “Your wins stay in your account inventory.”

### CAR-09 — Convert eligible prizes back to points

- **Challenge:** Customers may not want to ship every duplicate or low-value card.
- **Action:** Let eligible owned prizes be converted to points using a displayed return amount and immutable wallet credit entry.
- **Result:** Customers can recycle value into more draws, while vendors reduce low-value fulfillment load.
- **MVP acceptance:** Converted prize cannot be shipped or converted again; ledger entry links to prize.
- **Copy-safe claim:** “Eligible prizes can be converted back into points.”

### CAR-10 — Admin-assisted physical fulfillment without overclaiming

- **Challenge:** Customers expect a path to receive high-value physical prizes, but full shipping automation may not exist at MVP.
- **Action:** Provide a clear fulfillment request/status path, even if first version is admin-assisted rather than fully self-serve with address/payment/shipping labels.
- **Result:** Customers know how physical redemption works and what is still manual.
- **MVP acceptance:** Physical prize status + support/admin workflow; do not claim self-serve shipping unless address/fees/status are built.
- **Copy-safe claim:** “Physical fulfillment is handled through account support/admin workflow.”

### CAR-11 — Safe pack publishing

- **Challenge:** Vendors can accidentally publish packs with bad images, impossible stock, invalid odds, missing return amounts, or incomplete prize metadata.
- **Action:** Validate pack configuration before publish and provide preview/import errors.
- **Result:** Customers see complete, consistent pack pages and vendors avoid launch mistakes.
- **MVP acceptance:** Publish cannot proceed with invalid stock, missing required images/labels, invalid weights, or inconsistent totals.
- **Copy-safe claim:** Internal/admin feature; not public copy.

### CAR-12 — Support-ready dispute lookup

- **Challenge:** Customers will ask “what happened to my draw/wallet/prize?” and support needs fast answers.
- **Action:** Provide internal lookup by user, draw order, wallet entry, prize inventory record, and proof ID.
- **Result:** Support can resolve disputes quickly without engineering database access.
- **MVP acceptance:** Role-restricted support/admin page or endpoint; accesses only vendor-scoped data; audit logs lookup.
- **Copy-safe claim:** “Support can trace draw, wallet, and prize events.”

### CAR-13 — Abuse-resistant high-value campaigns

- **Challenge:** New-user offers, coupons, high-value packs, and scripted retries can be exploited.
- **Action:** Add rate limits, idempotency replay checks, eligibility records, audit logs, and admin-visible abuse signals.
- **Result:** Vendors can run attractive offers without uncontrolled exposure.
- **MVP acceptance:** Auth/rate limit/idempotency on draw/funding; defer coupons until abuse controls exist.
- **Copy-safe claim:** Internal/admin feature; avoid public anti-fraud specifics.

### CAR-14 — Vendor-scoped storefront isolation

- **Challenge:** Multiple operators need separate storefronts without separate codebases, and customers must not see cross-tenant inventory/wallet data.
- **Action:** Resolve vendor by host/header and scope packs, wallets, banners, tags, orders, proofs, and admin actions by vendor.
- **Result:** Each vendor can run an isolated storefront on shared SaaS infrastructure.
- **MVP acceptance:** Cross-vendor tests for packs, wallet, draw, proof, admin routes.
- **Copy-safe claim:** “Vendor-scoped storefronts on one reusable platform.”

### CAR-15 — Compliance/product guardrails

- **Challenge:** Chance-based packs can trigger age, region, payment, and consumer-protection concerns.
- **Action:** Model age/content flags, region availability, terms/disclaimer surfaces, probability disclosure policy, and unsupported-market behavior separately from draw logic.
- **Result:** Operators can avoid exposing ineligible customers to restricted packs or unsupported fulfillment promises.
- **MVP acceptance:** Terms links, basic region/age policy decision, admin product flags; legal review before public paid launch.
- **Copy-safe claim:** “Availability may vary by region and account eligibility.”

## Customer-facing homepage copy draft

### Conservative MVP hero

> Launch trustworthy TCG mystery-pack storefronts with clear prize lineups, wallet-backed draws, idempotent purchase protection, owned-prize inventory, and customer-verifiable fairness records.

### Short customer promise

> Browse packs by collector intent, review prize tiers before drawing, open packs with protected retries, verify your result, and manage eligible prizes after the draw.

### Vendor promise

> Oripa SaaS gives operators reusable tools for pack merchandising, inventory control, wallet ledgers, fairness proofs, audit trails, and support traceability without rebuilding Oripa infrastructure for every storefront.

### Trust section bullets

- **Clear before draw:** prize lineups, stock, pricing, tags, and eligibility shown upfront.
- **Protected at draw:** authenticated wallet debit, idempotency, and transactional inventory updates.
- **Verifiable after draw:** proof record with seed reveal, pool snapshot hash, and selection details.
- **Manageable after win:** owned-prize inventory with conversion or fulfillment workflow.

## Claims to avoid until implemented

- “Fully automated shipping” unless address selection, shipping fees, fulfillment status, and shipment creation exist.
- “Multiple payment methods” unless more than one real provider is live.
- “Provably fair” without customer-readable proof page and verification steps.
- “Exact odds” unless product policy and UI expose exact rates consistently.
- “Vendor self-service SaaS” unless vendor-admin UI, roles, isolation, and publish validation exist.
- “New-user/daily/rank/RUSH bonuses” until centralized eligibility and result grouping support those mechanics.
- “Insured/vaulted physical custody” unless custody/insurance/storage operations exist.

## Implementation handoff priorities for @HRMcodingbot

1. **Fix wallet auth/user scoping first.**
   Current `/v1/wallet` returns first wallet for vendor, not authenticated user wallet. This is the highest-severity customer trust blocker.

2. **Add/verify proof page UX.**
   Backend proof endpoint exists; build result/proof pages and link them.

3. **Add user prize inventory model/flow if incomplete.**
   Draw success should create customer-managed owned prizes.

4. **Decide first funding path.**
   Stripe vs manual pilot credit changes both implementation and copy.

5. **Add category/tag/sort storefront model.**
   Clove-like conversion depends on browsing by category, tags, and purchase intent.

6. **Centralize eligibility.**
   Avoid list/detail/draw mismatches.

7. **Add convert-to-points.**
   This is more MVP-relevant than full shipping automation.

8. **Add publish validation/import workflow.**
   Prevent bad packs before public launch.

9. **Add support dispute lookup.**
   Trust stack must be operable by support, not only database-aware engineers.

10. **Defer advanced Clove mechanics.**
   RUSH, last-one, round-number, rank, coupons, multi-payment, and full vendor CMS are roadmap unless explicitly prioritized.

## Confidence

- High confidence that trust/fairness/wallet/prize-inventory CARs are the correct MVP center: **0.86**.
- Medium-high confidence on competitor positioning because public pages are marketing-heavy and not full implementation proof: **0.74**.
- High confidence on local repo blocker for wallet scoping because source code directly shows vendor-only wallet lookup: **0.93**.
- Medium confidence on regulatory/compliance details because this is product research, not legal advice: **0.65**.

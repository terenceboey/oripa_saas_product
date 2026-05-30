# Oripa SaaS Customer Stories Proposal

Source docs:
- `docs/reference-clove-pokemon-deep-dive.md`
- `docs/oripa-saas-car-proposal-reviewed.md`

Purpose: convert the Clove Pokemon Oripa reverse-engineering report and Oracle-reviewed CAR taxonomy into customer stories that can drive product scope, acceptance criteria, and implementation tickets.

## Assumptions

- Customer stories use the format: **As a [persona], I want [capability], so that [outcome].**
- “Customer” includes end players, vendor operators, platform admins, support staff, and finance/ops users.
- MVP stories must stay aligned with the tightened CAR loop:
  `browse pack → view lineup/limits → top up or seeded wallet → authenticated draw → idempotent fair result → user prize inventory → proof lookup → return-to-points or admin-assisted fulfillment`
- Shipping, multiple payment rails, promotions, RUSH, rank progression, and full vendor self-service CMS are roadmap stories unless explicitly promoted later.
- Stories should be implementation-grounded in the existing monorepo architecture: Express + Prisma API, Next.js web, vendor scoping, JWT auth, wallet ledger, idempotent draws, fairness proofs, and Render deployment.

## Integration risks

- **Wallet and draw stories depend on fixing user scope.** Current wallet read behavior must filter by `vendorId + authenticated user` before any customer-facing wallet story is considered complete.
- **Fairness stories depend on proof UX.** Storing fairness metadata is not enough; customers need a readable proof lookup/result page.
- **Prize ownership stories require a durable user prize inventory model.** Draw result rows alone cannot support post-draw management.
- **Eligibility stories must avoid split-brain logic.** List, detail, and draw APIs should use the same eligibility service/rules.
- **Admin stories require least-privilege controls.** Even an MVP admin/import flow must not allow cross-tenant data access.
- **Shipping and payment stories must not overclaim.** If MVP uses manual credits or admin-assisted fulfillment, product copy must say so.

## Personas

### Player / Collector

End customer who browses packs, buys or receives points, draws, verifies outcomes, and manages prizes.

### New Player

First-time customer evaluating trust, signup friction, pack clarity, and whether the product feels safe to try.

### Vendor Operator

Tenant/business owner or staff member responsible for launching packs, merchandising campaigns, managing prizes, and reviewing performance.

### Platform Admin

Internal operator with cross-tenant responsibility for configuration, controlled imports, support escalation, and safe publishing.

### Support Agent

Internal or vendor support role that answers customer disputes about wallet debits, draw outcomes, proof records, and prize status.

### Finance / Ops

Internal role responsible for ledger reconciliation, payment state, vendor revenue, failed jobs, and operational anomalies.

## MVP customer stories

### Player browsing and discovery

#### STORY-DISCOVERY-01 — Browse packs by category

**As a** player,
**I want** to browse Oripa packs by category such as Pokemon, One Piece, Yu-Gi-Oh, Weiss Schwarz, Hobby, Figure, and RUSH,
**so that** I can quickly find packs that match the collectibles I care about.

Acceptance criteria:
- Storefront has category navigation backed by API category filtering.
- Category state is reflected in URLs or query params where appropriate.
- Empty categories show a friendly empty state, not a broken page.
- Vendor scope is respected via host or `x-vendor-host`.

Priority: MVP.
Related CARs: CAR-DISCOVERY-01, CAR-TENANT-01.
Dependencies: category field/model or compatible pack metadata.

#### STORY-DISCOVERY-02 — Filter packs by collector intent tags

**As a** player,
**I want** to filter packs by tags like PSA10, Charizard, BOX, High Chance Profit, Beginner Only, and Final Drawer Bonus,
**so that** I can shop using collector language instead of scanning every pack manually.

Acceptance criteria:
- Tags are vendor-scoped.
- Tags have display labels and stable identifiers.
- Pack list endpoint accepts tag filters.
- UI displays active tags and allows clearing them.
- Filtering does not expose packs from another vendor.

Priority: MVP.
Related CARs: CAR-DISCOVERY-02.
Dependencies: `Tag` / pack-tag association or equivalent.

#### STORY-DISCOVERY-03 — Sort packs by purchase intent

**As a** player,
**I want** to sort packs by newest, recommended, price low-to-high, price high-to-low, and nearly sold out,
**so that** I can browse according to my budget, urgency, or appetite for premium packs.

Acceptance criteria:
- API supports at least newest and price ascending/descending.
- Recommended and nearly-sold-out sorts are deterministic and documented.
- UI clearly shows current sort.
- Sort state works together with category and tag filters.

Priority: MVP.
Related CARs: CAR-DISCOVERY-03.
Dependencies: pack price, publish time, remaining stock, recommendation rank where available.

### Product detail and eligibility

#### STORY-DETAIL-01 — View prize-grade lineup before drawing

**As a** player,
**I want** to see prize lineups grouped by grade,
**so that** I can evaluate chase prizes, mid-tier prizes, filler prizes, and bonus prizes before spending points.

Acceptance criteria:
- Detail page groups displayed prizes by supported grade.
- MVP supports FIRST, SECOND, THIRD, FOURTH at minimum if data exists.
- Optional groups such as EXTRA, ROUND_NUMBER, and LAST_ONE render only when configured.
- Each group has clear labels and does not imply unsupported bonus mechanics.

Priority: MVP.
Related CARs: CAR-DETAIL-01.
Dependencies: prize type metadata.

#### STORY-DETAIL-02 — Inspect card-specific prize metadata

**As a** TCG collector,
**I want** to see each prize’s image, card name, condition, rarity/sub-description, card code, reference value, and display quantity,
**so that** I can judge whether a pack is worth drawing.

Acceptance criteria:
- Prize cards show image and meaningful fallback text.
- Condition/card code/reference value are displayed only when available.
- Missing optional metadata does not break layout.
- API response avoids exposing operational fields that should remain private pre-draw.

Priority: MVP.
Related CARs: CAR-DETAIL-02.
Dependencies: extended prize metadata.

#### STORY-DETAIL-03 — See availability and limits before drawing

**As a** player,
**I want** to see remaining stock, total pack quantity, open/close time, countdown state, and my draw eligibility,
**so that** I do not attempt to draw a sold-out, unavailable, or restricted pack.

Acceptance criteria:
- List/detail pages show sold-out status.
- Detail page shows timing and per-user limit state when configured.
- Eligibility result is consistent with draw API enforcement.
- Restricted/unavailable states disable draw CTA with a clear reason.

Priority: MVP.
Related CARs: CAR-DETAIL-03, CAR-ELIGIBILITY-01.
Dependencies: centralized eligibility service.

#### STORY-ELIGIBILITY-01 — Get one consistent draw eligibility decision

**As a** player,
**I want** the storefront and draw checkout to agree about whether I can draw,
**so that** I am not surprised by a rejection after choosing a pack.

Acceptance criteria:
- Eligibility logic checks stock, publish status, open/close windows, auth requirement, and per-user draw limits.
- Same eligibility helper/service is used by list/detail/draw paths or shares one source of truth.
- API returns stable reason codes such as `SOLD_OUT`, `BEFORE_RELEASE`, `LIMIT_REACHED`, `AUTH_REQUIRED`, and `AVAILABLE`.
- Unsupported future gates are not silently treated as available.

Priority: MVP.
Related CARs: CAR-ELIGIBILITY-01.
Dependencies: auth identity and pack/gate metadata.

### Account, wallet, and funding

#### STORY-ACCOUNT-01 — Sign in before sensitive actions

**As a** player,
**I want** to sign in before viewing wallet, drawing, or managing prizes,
**so that** my balance and prize ownership are tied to my account.

Acceptance criteria:
- Wallet, draw, prize inventory, return-to-points, and proof history actions require JWT bearer auth where user scope is needed.
- Public pack browsing remains available without auth.
- Unauthenticated draw attempts return clear auth-required responses.
- Frontend routes provide a clear sign-in path.

Priority: MVP.
Related CARs: CAR-WALLET-01, CAR-ACCOUNT-01.
Dependencies: existing auth routes/JWT middleware.

#### STORY-WALLET-01 — View my own wallet balance and ledger

**As a** player,
**I want** to view only my own point balance and recent ledger entries,
**so that** I can trust that my funds are private and accurate.

Acceptance criteria:
- Wallet query filters by both vendor and authenticated user.
- Response includes current balance and recent ledger entries.
- User A cannot view user B’s wallet under the same vendor.
- Same user cannot cross vendor boundaries unless they have a wallet in that vendor.

Priority: Phase 0 / MVP blocker.
Related CARs: CAR-WALLET-01, CAR-WALLET-02.
Dependencies: wallet endpoint auth fix.

#### STORY-WALLET-02 — Enter the draw loop with one funded-wallet path

**As a** player,
**I want** a clear way to receive or buy points,
**so that** I can draw without hidden manual steps.

Acceptance criteria:
- MVP explicitly supports one path: Stripe Checkout, pilot manual credits, or another approved funding method.
- Funding events create immutable wallet ledger entries.
- UI copy matches the actual funding path; no claim of multiple providers unless shipped.
- Failed/expired funding attempts do not credit the wallet.

Priority: MVP.
Related CARs: CAR-WALLET-03A.
Dependencies: chosen funding path decision.

#### STORY-WALLET-03 — Understand every point movement

**As a** player,
**I want** every top-up, draw debit, return-to-points credit, refund, or admin adjustment to appear in my ledger,
**so that** I can explain my balance at any time.

Acceptance criteria:
- Ledger entries include type, amount, timestamp, and related entity IDs when applicable.
- Draw debits and return-to-points credits are linked to draw/prize records.
- Ledger is append-only for customer-visible financial events.
- Support/admin adjustment entries are labeled clearly.

Priority: MVP.
Related CARs: CAR-WALLET-02.
Dependencies: wallet ledger semantics.

### Draw and fairness

#### STORY-DRAW-01 — Perform one idempotent paid draw

**As a** player,
**I want** a draw request to charge points once even if my browser retries,
**so that** I do not lose extra points because of double-clicks or network issues.

Acceptance criteria:
- Draw endpoint requires an idempotency key.
- Repeating the same request with the same scope returns the original result.
- Conflicting replay under same idempotency key is rejected or handled safely.
- Wallet debit, stock decrement, draw result, fairness proof, and audit log are atomic.

Priority: MVP.
Related CARs: CAR-DRAW-01.
Dependencies: existing idempotency model and transaction flow.

#### STORY-DRAW-02 — See clear draw results

**As a** player,
**I want** my draw result to clearly separate normal prizes and supported bonus/result groups,
**so that** I understand exactly what I won.

Acceptance criteria:
- Result response includes won prize metadata needed by UI.
- MVP returns normal prize groups and empty/absent optional groups for unsupported mechanics.
- Response can later support `extraPrizes`, `roundNumberPrize`, `lastOnePrize`, and virtual prizes without breaking clients.
- Result page survives refresh or direct navigation by draw order ID.

Priority: MVP.
Related CARs: CAR-DRAW-02, CAR-DETAIL-01.
Dependencies: draw result contract and prize metadata.

#### STORY-DRAW-03 — Avoid oversold outcomes under concurrency

**As a** player,
**I want** the pack to produce only valid, fulfillable outcomes even during high traffic,
**so that** I do not win a prize the vendor cannot provide.

Acceptance criteria:
- Draw transaction safely decrements pack and prize stock.
- Failed stock checks roll back wallet debit and draw result creation.
- Concurrency tests or load tests verify no negative stock/oversold prize outcomes.
- Errors are customer-readable and do not leak internals.

Priority: MVP.
Related CARs: CAR-DRAW-03.
Dependencies: serializable transaction and stock locking verification.

#### STORY-FAIRNESS-01 — Verify my draw after the result

**As a** player,
**I want** a proof page or lookup for my draw,
**so that** I can verify the platform did not change the outcome after I paid.

Acceptance criteria:
- Each paid draw has a linked fairness proof record.
- Proof page shows plain-English verification steps.
- Proof includes needed commitment/reveal data and selection metadata appropriate for customer verification.
- Proof lookup is scoped safely and does not expose unrelated user data.

Priority: MVP.
Related CARs: CAR-TRUST-01.
Dependencies: fairness proof API and result page UX.

### Prize ownership and post-draw management

#### STORY-PRIZE-01 — See my owned prizes after drawing

**As a** player,
**I want** prizes I win to appear in my account inventory,
**so that** I can manage them after leaving the draw result page.

Acceptance criteria:
- Successful draws create user prize inventory records.
- Inventory is vendor-scoped and user-scoped.
- Inventory shows prize image/name/condition/status and source draw order.
- Refreshing the app does not lose prize ownership state.

Priority: MVP.
Related CARs: CAR-FULFILL-01.
Dependencies: user prize inventory model.

#### STORY-PRIZE-02 — Convert eligible prizes back to points

**As a** player,
**I want** to convert eligible prizes back to points,
**so that** I can keep drawing instead of shipping every low-value or duplicate prize.

Acceptance criteria:
- Eligible prizes display return amount before conversion.
- Conversion creates an immutable wallet credit ledger entry.
- Converted prizes cannot be shipped or converted again.
- Ineligible shipping-only prizes cannot be converted.

Priority: MVP.
Related CARs: CAR-FULFILL-02A.
Dependencies: user prize inventory, return amount metadata, wallet ledger.

#### STORY-PRIZE-03 — Request admin-assisted fulfillment for physical prizes

**As a** player,
**I want** a simple way to indicate that I want a physical prize fulfilled,
**so that** I can receive high-value cards even before full self-serve shipping is built.

Acceptance criteria:
- MVP does not overclaim full shipping automation.
- Physical prizes can be marked as fulfillment requested or reserved for admin-assisted handling.
- User sees fulfillment status and support instructions.
- Address/payment/shipping fee automation is explicitly deferred unless implemented.

Priority: MVP if physical prizes are sold; otherwise roadmap.
Related CARs: CAR-FULFILL-01, CAR-FULFILL-04 roadmap.
Dependencies: fulfillment policy decision.

### Vendor and admin operations

#### STORY-ADMIN-01 — Create packs through controlled admin/import workflow

**As a** platform admin,
**I want** to create packs and prize lineups through a controlled UI or structured import,
**so that** real packs can launch without direct database edits.

Acceptance criteria:
- Admin/import flow creates vendor-scoped packs and prizes.
- Required fields are validated before save/publish.
- Import errors are actionable and identify bad rows/fields.
- Non-admin users cannot create cross-tenant data.

Priority: MVP.
Related CARs: CAR-TENANT-03A.
Dependencies: admin auth/roles and pack/prize models.

#### STORY-ADMIN-02 — Validate pack readiness before publish

**As a** platform admin,
**I want** the system to block unsafe pack publishing,
**so that** customers do not see broken packs or impossible prize configurations.

Acceptance criteria:
- Publish validation checks images, prize groups, stock totals, return amounts, timing, vendor ownership, and proof/draw eligibility requirements.
- Validation returns field-level errors.
- Draft packs can be incomplete; published packs cannot.
- Publish action is audited.

Priority: MVP.
Related CARs: CAR-ADMIN-01.
Dependencies: publish status and validation service.

#### STORY-ADMIN-03 — Manage vendor-scoped tags and categories

**As a** platform admin or vendor operator,
**I want** to manage storefront tags and category assignment,
**so that** customers can browse packs using campaign and collector language.

Acceptance criteria:
- Tags are vendor-scoped.
- Tags support label, display order, optional badge color, and active/inactive state.
- Pack-tag assignments are controlled by authorized users only.
- Deleted/disabled tags do not break existing pack pages.

Priority: MVP.
Related CARs: CAR-DISCOVERY-02, CAR-TENANT-02.
Dependencies: tag model and admin permissions.

#### STORY-ADMIN-04 — Enforce least-privilege admin access

**As a** platform owner,
**I want** admin actions to respect platform-admin and vendor-staff boundaries,
**so that** one vendor cannot view or modify another vendor’s business.

Acceptance criteria:
- Platform admins can access cross-tenant tools only where intended.
- Vendor staff can access only their vendor’s packs, tags, banners, orders, and support records.
- Unauthorized admin attempts return 403 and are auditable.
- Tests cover at least one cross-vendor denial path per sensitive module.

Priority: MVP.
Related CARs: CAR-TENANT-02.
Dependencies: role/membership model and middleware.

### Support, audit, and operations

#### STORY-SUPPORT-01 — Lookup a draw dispute

**As a** support agent,
**I want** to look up a draw order and see related wallet entry, prize result, proof record, and audit events,
**so that** I can answer customer disputes without asking engineering to query the database.

Acceptance criteria:
- Lookup supports draw order ID and user context.
- View shows wallet debit, prize outcomes, fairness proof ID, and key timestamps.
- Support access is role-restricted and vendor-scoped where appropriate.
- Lookup does not expose unrelated users’ data.

Priority: MVP.
Related CARs: CAR-SUPPORT-01, CAR-TRUST-02.
Dependencies: support/admin endpoint or internal UI.

#### STORY-SUPPORT-02 — Explain a wallet balance

**As a** support agent,
**I want** to inspect a customer’s wallet ledger for a vendor,
**so that** I can explain balance changes and resolve refund/credit questions.

Acceptance criteria:
- Support lookup shows ledger entries with related draw/top-up/return IDs.
- Access is role-restricted and audited.
- Ledger entries are immutable; adjustments are new entries, not edits.
- Cross-vendor access is blocked unless platform-admin scope is explicit.

Priority: MVP.
Related CARs: CAR-WALLET-02, CAR-SUPPORT-01.
Dependencies: wallet ledger and admin auth.

#### STORY-OPS-01 — Detect failed or stuck operational events

**As a** finance/ops user,
**I want** failed payments, stuck outbox events, draw anomalies, and fulfillment failures to be visible,
**so that** I can fix issues before they become customer disputes.

Acceptance criteria:
- Outbox/worker failures are surfaced in logs or internal status views.
- Payment/draw/prize status transitions are inspectable.
- Reconciliation mismatches have an operational signal.
- Alerts/dashboards can be deferred, but the data needed for them is captured.

Priority: MVP-light / early roadmap.
Related CARs: CAR-OPS-01.
Dependencies: worker/outbox conventions and logging.

#### STORY-SECURITY-01 — Resist duplicate and scripted abuse

**As a** vendor operator,
**I want** draw and wallet flows protected from retries, scripted abuse, and duplicate account exploitation,
**so that** campaigns do not create uncontrolled financial exposure.

Acceptance criteria:
- Idempotency replay is enforced for draws.
- Sensitive endpoints require auth and vendor scope.
- Basic rate limiting or equivalent abuse controls are defined for draw/funding endpoints before public launch.
- Abuse-relevant events are auditable.

Priority: MVP.
Related CARs: CAR-SECURITY-01.
Dependencies: auth, idempotency, audit logs, rate-limit decision.

## Roadmap customer stories, not MVP promises

### STORY-DEMO-01 — Try a demo gacha without spending points

**As a** new player,
**I want** to try a clearly labeled demo draw,
**so that** I can understand the experience before spending points.

Roadmap note: demo must be labeled as illustrative/non-real and must not imply real odds unless tied to actual draw configuration.

### STORY-SHIPPING-01 — Self-serve shipping request

**As a** player,
**I want** to select owned prizes, choose an address, see shipping requirements/fees, and request shipment,
**so that** I can redeem physical prizes without contacting support.

Roadmap note: only claim once address CRUD, selected prize shipping, fee checks, and status tracking exist.

### STORY-PAYMENT-02 — Choose from multiple payment providers

**As a** player,
**I want** to choose from supported local payment methods,
**so that** I can top up using the provider I trust.

Roadmap note: start with one funded-wallet path; defer PayPay/GMO-style expansion.

### STORY-PROMO-01 — Redeem coupons or promotion codes

**As a** player,
**I want** to redeem campaign codes or point coupons,
**so that** I can participate in vendor promotions.

Roadmap note: defer until abuse controls and ledger semantics are settled.

### STORY-GATE-01 — Access new-user or daily packs

**As a** player,
**I want** special packs for new users or daily return visits,
**so that** I have clear reasons to start and come back.

Roadmap note: depends on centralized eligibility and anti-abuse controls.

### STORY-GATE-02 — Unlock rank-limited packs

**As a** loyal player,
**I want** to access packs based on my rank,
**so that** continued engagement unlocks better opportunities.

Roadmap note: do not claim rank progression until rank earning/calculation exists; manual/admin-assigned rank gates can ship first if needed.

### STORY-BONUS-01 — Win last-one, round-number, or extra threshold prizes

**As a** player,
**I want** clearly explained bonus prize mechanics,
**so that** I understand urgency and milestone opportunities.

Roadmap note: keep draw response extensible, but do not market these until implemented and tested.

### STORY-RUSH-01 — Use virtual RUSH tickets

**As a** player,
**I want** virtual ticket prizes to unlock a follow-on draw loop,
**so that** the platform has deeper progression beyond one-off packs.

Roadmap note: later virtual-prize loop; not MVP.

### STORY-NOTIFICATION-01 — Receive account and prize notifications

**As a** player,
**I want** notifications for prize wins, payment status, shipping status, and expiring offers,
**so that** I do not miss important actions.

Roadmap note: event modeling can start early, but delivery claims require actual email/SMS/push implementation.

## Suggested story implementation order

1. STORY-WALLET-01 — user-scoped wallet balance and ledger.
2. STORY-ACCOUNT-01 — auth requirement for sensitive actions.
3. STORY-DRAW-01 — idempotent paid draw verification.
4. STORY-DRAW-03 — concurrency/stock safety verification.
5. STORY-FAIRNESS-01 — customer-readable proof lookup.
6. STORY-DISCOVERY-01/02/03 — category, tags, sorts.
7. STORY-DETAIL-01/02/03 — lineups, metadata, availability.
8. STORY-ELIGIBILITY-01 — centralized eligibility across list/detail/draw.
9. STORY-PRIZE-01 — user prize inventory records on successful draw.
10. STORY-PRIZE-02 — convert eligible prizes to points.
11. STORY-WALLET-02 — first funded-wallet path.
12. STORY-ADMIN-01/02/03/04 — controlled pack/tag/admin workflow.
13. STORY-SUPPORT-01/02 — dispute and ledger lookup.
14. STORY-SECURITY-01 and STORY-OPS-01 — launch hardening.
15. Roadmap mechanics: shipping self-service, payments expansion, promo codes, gates, bonuses, RUSH, notifications.

## Definition of ready for implementation tickets

A customer story is ready to turn into code tickets when:

- Persona and outcome are clear.
- Acceptance criteria identify API, web, data model, and auth boundaries.
- Vendor scope and user scope are explicit.
- Public versus internal/admin visibility is explicit.
- MVP versus roadmap status is explicit.
- Any overclaiming risk has been removed from user-facing copy.
- Required env/deploy behavior is known.

## Definition of done for MVP stories

A story is done when:

- API behavior is implemented with existing repo conventions.
- Web behavior is implemented using existing CSS/style patterns.
- Prisma/data changes include seed or migration implications as needed.
- JWT auth and vendor scoping are tested where sensitive data is involved.
- `npm run build -w @oripa/api` passes.
- `npm run build -w @oripa/web` passes for web-facing changes.
- README is updated if env/config/runtime behavior changed.
- No unsupported roadmap feature is implied in UI copy.

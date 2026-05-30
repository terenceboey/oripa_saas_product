# Oripa SaaS Customer Stories — Oracle Reviewed

Source docs:
- `docs/reference-clove-pokemon-deep-dive.md`
- `docs/oripa-saas-car-proposal-reviewed.md`
- `docs/oripa-saas-customer-stories-proposal.md`
- Oracle review artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/oripa-saas-customer-stories-review-final.md`

Oracle decision: **revise before ticketing** with confidence `0.82`.

This reviewed version applies Oracle's corrections:
- Move funding, admin/import, eligibility, and prize inventory earlier.
- Treat user prize inventory as part of draw MVP, not a later add-on.
- Narrow fairness proof claims to what the proof actually proves.
- Remove/soften risky tag examples such as “High Chance Profit,” RUSH, Beginner Only, and Final Drawer Bonus unless those mechanics are implemented.
- Add missing stories for disclosure policy, draw history, pack snapshots, idempotency scope, admin credits/refunds, data retention, and seeded-wallet pilot.
- Make acceptance criteria more transactional, scoped, and testable.

## Final MVP loop

`vendor-scoped browse/detail → authenticated account → funded or seeded wallet → central eligibility → idempotent paid draw → atomic ledger/result/inventory/proof snapshot → result page/draw history → proof lookup → return-to-points or admin-assisted fulfillment → support lookup`

## MVP implementation order

1. Auth and vendor/user scoping.
2. Wallet ledger and seeded/manual funding path or first payment provider.
3. Admin/import pack creation and publish validation.
4. Pack detail with lineup, stock, price, limits, and disclosure policy.
5. Central eligibility service.
6. Idempotency scope and replay handling.
7. Idempotent paid draw with serializable transaction.
8. Atomic user prize inventory creation inside draw transaction.
9. Fairness proof generation, pack snapshot reference, result page, and proof lookup.
10. Draw history.
11. Return-to-points with idempotency/concurrency protection.
12. Minimal support/admin dispute lookup.
13. Basic public browse categories; tags/sorts only where implemented safely.
14. Abuse controls, redaction, retention, and ops visibility.
15. Roadmap mechanics: shipping self-service, promotions, multiple payment rails, special gates, bonuses, RUSH, notifications.

## MVP customer stories

### STORY-SCOPE-01 — Enforce vendor and user scope everywhere sensitive

**As a** platform owner,
**I want** sensitive data access to require the correct vendor and user scope,
**so that** customers, vendors, and admins cannot leak data across accounts or tenants.

Acceptance criteria:
- Public pack browsing may be anonymous but remains vendor-scoped.
- Wallet, draw, prize inventory, return-to-points, draw history, proof history, and customer support views require JWT auth where user data is involved.
- Every sensitive query filters by `vendorId` and the appropriate authenticated `userId` or authorized admin/vendor membership.
- Cross-vendor attempts return 403 or 404 according to existing repo style and are auditable for admin/support paths.
- Tests cover at least one cross-user denial and one cross-vendor denial for wallet/prize/draw history.

Priority: Phase 0 / MVP blocker.
Related CARs: CAR-WALLET-01, CAR-TENANT-01, CAR-TENANT-02.

### STORY-WALLET-01 — View my own wallet balance and ledger

**As a** player,
**I want** to view only my own point balance and recent ledger entries,
**so that** I can trust that my funds are private and accurate.

Acceptance criteria:
- Wallet query filters by both `vendorId` and authenticated `userId`.
- Response includes current balance and recent ledger entries.
- Balance is derived from ledger or reconciled against ledger with documented consistency behavior.
- Ledger entries include type, amount, timestamp, and related entity IDs when applicable.
- User A cannot view user B's wallet under the same vendor.
- Same user cannot cross vendor boundaries unless they have a wallet in that vendor.

Priority: Phase 0 / MVP blocker.
Related CARs: CAR-WALLET-01, CAR-WALLET-02.

### STORY-WALLET-02A — Seed a pilot wallet or support one funding path

**As a** player,
**I want** a clear way to receive or buy points,
**so that** I can enter the draw loop without hidden manual steps.

Acceptance criteria:
- MVP explicitly supports one path: admin-seeded/manual credit for pilot, Stripe Checkout, or another approved provider.
- Funding events create immutable wallet ledger entries with actor/source/reason where applicable.
- UI copy matches reality: use “manual pilot credit” if points are seeded; do not say “buy points” unless a payment provider is live.
- Failed/expired payment attempts do not credit the wallet.
- Manual credits/refunds are role-restricted, vendor-scoped, reason-coded, and audited.

Priority: MVP.
Related CARs: CAR-WALLET-03A.

### STORY-ADMIN-01 — Create packs through controlled admin/import workflow

**As a** platform admin,
**I want** to create packs and prize lineups through a controlled UI, seed script, or structured import,
**so that** real packs can launch without direct database edits.

Acceptance criteria:
- Admin/import flow creates vendor-scoped packs and prizes.
- Required fields are validated before save/publish.
- Import errors are actionable and identify bad rows/fields.
- Non-admin users cannot create cross-tenant data.
- Pack creation path is documented enough for repeatable launch operations.

Priority: MVP.
Related CARs: CAR-TENANT-03A.

### STORY-ADMIN-02 — Validate pack readiness before publish

**As a** platform admin,
**I want** the system to block unsafe pack publishing,
**so that** customers do not see broken packs or impossible prize configurations.

Acceptance criteria:
- Draft packs may be incomplete; published packs cannot.
- Publish validation checks vendor ownership, publish status, image presence, price, stock totals, prize stock, displayed quantities, prize grades, return amounts, timing, and draw/proof eligibility requirements.
- Validation checks prize quantity totals against pack quantity and draw algorithm assumptions.
- Validation returns field-level errors.
- Publish action is audited with actor, vendor, pack ID, and timestamp.

Priority: MVP.
Related CARs: CAR-ADMIN-01.

### STORY-DISCLOSURE-01 — Understand price, availability, and prize disclosure before drawing

**As a** player,
**I want** clear disclosure of price, remaining quantity, prize groups, displayed quantities, and the platform’s odds/availability policy,
**so that** I can decide whether to draw without being misled.

Acceptance criteria:
- Detail page shows price, remaining count, total quantity, and supported prize-grade lineups.
- Product copy distinguishes displayed lineup from exact operational odds if exact odds are not shown.
- If exact odds are not public pre-draw, page explains what is verified after draw via proof/snapshot.
- Marketing tags do not imply unsupported mechanics or profit claims.
- Terms like “recommended” and “nearly sold out” are backed by deterministic data rules if shown.

Priority: MVP.
Related CARs: CAR-TRUST-03, CAR-DETAIL-01, CAR-DETAIL-03.

### STORY-DETAIL-01 — View prize-grade lineup before drawing

**As a** player,
**I want** to see prize lineups grouped by grade,
**so that** I can evaluate chase prizes, mid-tier prizes, filler prizes, and supported bonus prizes before spending points.

Acceptance criteria:
- Detail page groups displayed prizes by supported grade.
- MVP supports configured visible grades only; optional groups such as EXTRA, ROUND_NUMBER, and LAST_ONE render only when implemented and enforced.
- Each group has clear labels and does not imply unsupported bonus mechanics.
- API response avoids exposing operational fields that should remain private pre-draw.

Priority: MVP.
Related CARs: CAR-DETAIL-01.

### STORY-DETAIL-02 — Inspect card-specific prize metadata

**As a** TCG collector,
**I want** to see each prize's image, card name, condition, rarity/sub-description, card code, reference value, and display quantity,
**so that** I can judge whether a pack is worth drawing.

Acceptance criteria:
- Prize cards show image and meaningful fallback text.
- Condition/card code/reference value are displayed only when available.
- Missing optional metadata does not break layout.
- Metadata shown to customers matches pack snapshot/proof semantics where relevant.

Priority: MVP.
Related CARs: CAR-DETAIL-02.

### STORY-ELIGIBILITY-01 — Get one consistent draw eligibility decision

**As a** player,
**I want** the storefront and draw checkout to agree about whether I can draw,
**so that** I am not surprised by a rejection after choosing a pack.

Acceptance criteria:
- One eligibility service/helper is used by list/detail/draw paths or shares one documented source of truth.
- Eligibility checks stock, publish status, open/close windows, auth requirement, per-user draw limits, and vendor/user scope.
- API returns stable reason codes such as `AVAILABLE`, `AUTH_REQUIRED`, `SOLD_OUT`, `BEFORE_RELEASE`, `CLOSED`, `LIMIT_REACHED`, and `NOT_ELIGIBLE`.
- Unsupported future gates are not silently treated as available.
- Draw API re-checks eligibility inside the transaction where state can change.

Priority: MVP.
Related CARs: CAR-ELIGIBILITY-01.

### STORY-IDEMPOTENCY-01 — Scope idempotency keys safely

**As a** platform operator,
**I want** idempotency keys to be scoped and replayed consistently,
**so that** retries do not duplicate charges while conflicting requests cannot reuse the same key unsafely.

Acceptance criteria:
- Idempotency scope is defined, preferably `vendorId + userId + action/endpoint + idempotencyKey`.
- Request body hash or equivalent conflict detection is stored where needed.
- Exact replay returns the original result.
- Conflicting replay under the same key is rejected with a stable error.
- Idempotency records do not allow cross-user or cross-vendor replay.

Priority: MVP.
Related CARs: CAR-DRAW-01, CAR-SECURITY-01.

### STORY-DRAW-01 — Perform one idempotent paid draw atomically

**As a** player,
**I want** a draw request to charge points once and produce a durable result,
**so that** I do not lose points or prizes because of retries or partial failures.

Acceptance criteria:
- Draw endpoint requires JWT auth and an idempotency key.
- Wallet debit, pack/prize stock update, prize selection, draw order, draw result, fairness proof/snapshot reference, user prize inventory record, audit event, and outbox event are created atomically or with documented compensation for non-transactional parts.
- Repeating the same request with the same idempotency scope returns the original result.
- Conflicting replay under same idempotency key is rejected or handled safely.
- Errors do not leak internal algorithm/DB details.

Priority: MVP.
Related CARs: CAR-DRAW-01, CAR-DRAW-03, CAR-FULFILL-01.

### STORY-DRAW-02 — Avoid oversold outcomes under concurrency

**As a** player,
**I want** the pack to produce only valid, fulfillable outcomes even during high traffic,
**so that** I do not win a prize the vendor cannot provide.

Acceptance criteria:
- Draw transaction uses documented database safety: serializable isolation, conditional updates, row locks, unique constraints, or a proven combination.
- Failed stock checks roll back wallet debit and draw result creation.
- Concurrency tests verify no negative pack stock and no oversold prize outcomes.
- Customer-facing copy says “designed to prevent oversold outcomes” until load/concurrency testing is complete.

Priority: MVP.
Related CARs: CAR-DRAW-03.

### STORY-PRIZE-01 — Create my owned prize record during the draw

**As a** player,
**I want** prizes I win to become durable owned items immediately,
**so that** I can manage them after leaving the draw result page.

Acceptance criteria:
- Successful draw creates user prize inventory records in the same atomic draw flow as the wallet debit/result.
- Inventory records are vendor-scoped and user-scoped.
- Inventory shows prize image/name/condition/status and source draw order.
- Refreshing the app does not lose prize ownership state.
- Inventory records are not casually deletable after disputes, conversion, or fulfillment actions.

Priority: MVP / draw completion dependency.
Related CARs: CAR-FULFILL-01.

### STORY-SNAPSHOT-01 — Preserve the pack/prize snapshot used for a draw

**As a** player,
**I want** my draw proof and history to reference the pack configuration used at draw time,
**so that** later admin edits cannot change the meaning of my result.

Acceptance criteria:
- Draw stores or references an immutable pack/prize pool snapshot hash or snapshot record.
- Snapshot includes enough data to verify selection against the algorithm without exposing unrelated user data.
- Proof/history pages use the draw-time snapshot, not current mutable pack data, for verification-critical claims.
- Snapshot remains available after pack archive, prize conversion, or fulfillment.

Priority: MVP.
Related CARs: CAR-TRUST-01, CAR-TRUST-02.

### STORY-FAIRNESS-01 — Verify my draw after the result

**As a** player,
**I want** a proof page or lookup for my draw,
**so that** I can verify the platform followed the committed draw process.

Acceptance criteria:
- Each paid draw has a linked fairness proof record.
- Proof page shows plain-English verification steps.
- Proof defines exactly what it proves: commitment was created before reveal, server/client seed or nonce behavior, selection algorithm, and the pack/prize snapshot used.
- Proof does not claim to prove odds, stock, or availability beyond the data actually verifiable.
- Proof remains available after prize conversion or fulfillment.
- Authorization rules are explicit: public proof by opaque ID, authenticated own-history lookup, or admin/support lookup.

Priority: MVP.
Related CARs: CAR-TRUST-01.

### STORY-DRAW-HISTORY-01 — View my past draws

**As a** player,
**I want** a durable draw history,
**so that** I can revisit pack, debit, result, proof, and timestamp details after the result page.

Acceptance criteria:
- User can list their own draw history by vendor.
- Each entry includes draw order ID, pack title, point debit, result summary, timestamp, and proof link.
- History is user-scoped and vendor-scoped.
- Archived packs still render enough historical information for past draws.

Priority: MVP.
Related CARs: CAR-TRUST-02, CAR-FULFILL-01.

### STORY-PRIZE-02 — Convert eligible prizes back to points

**As a** player,
**I want** to convert eligible prizes back to points,
**so that** I can keep drawing instead of shipping every low-value or duplicate prize.

Acceptance criteria:
- Eligible prizes display return amount before conversion.
- Conversion requires auth and vendor/user scope.
- Conversion is idempotent or concurrency-safe, so a prize cannot be converted twice.
- Conversion creates an immutable wallet credit ledger entry linked to the user prize.
- Converted prizes cannot be shipped or converted again.
- Ineligible shipping-only prizes cannot be converted.

Priority: MVP.
Related CARs: CAR-FULFILL-02A.

### STORY-PRIZE-03 — Request admin-assisted fulfillment for physical prizes

**As a** player,
**I want** a simple way to indicate that I want a physical prize fulfilled,
**so that** I can receive high-value cards even before full self-serve shipping is built.

Acceptance criteria:
- MVP copy says admin-assisted fulfillment if address/payment/shipping automation is not built.
- Physical prizes can be marked as fulfillment requested or reserved for admin-assisted handling.
- User sees fulfillment status and support instructions.
- Address/payment/shipping fee automation is explicitly deferred unless implemented.

Priority: MVP only if physical prizes are sold; otherwise roadmap.
Related CARs: CAR-FULFILL-01.

### STORY-DISCOVERY-01 — Browse packs by category

**As a** player,
**I want** to browse Oripa packs by category,
**so that** I can quickly find packs that match the collectibles I care about.

Acceptance criteria:
- Storefront has category navigation backed by API category filtering.
- Empty categories show a friendly empty state.
- Category filtering respects vendor scope.
- Category examples in UI match implemented categories only.

Priority: MVP.
Related CARs: CAR-DISCOVERY-01.

### STORY-DISCOVERY-02 — Filter packs by safe collector tags

**As a** player,
**I want** to filter packs by implemented, non-misleading tags,
**so that** I can find packs by collector intent without being promised unsupported mechanics.

Acceptance criteria:
- Tags are vendor-scoped.
- Tags have display labels and stable identifiers.
- Pack list endpoint accepts tag filters.
- UI displays active tags and allows clearing them.
- MVP avoids risky tags such as “High Chance Profit,” “Beginner Only,” “Final Drawer Bonus,” and “RUSH” unless those claims/mechanics are implemented and enforced.

Priority: MVP if tag model is in scope; otherwise early roadmap.
Related CARs: CAR-DISCOVERY-02.

### STORY-DISCOVERY-03 — Sort packs by safe purchase intent

**As a** player,
**I want** to sort packs by implemented deterministic criteria,
**so that** I can browse by budget, recency, or inventory urgency.

Acceptance criteria:
- API supports at least newest and price ascending/descending if data exists.
- Recommended sort has a deterministic ranking rule if shown.
- Nearly-sold-out sort is based on reliable stock data if shown.
- Sort state works together with category and tag filters.

Priority: MVP if simple; otherwise early roadmap.
Related CARs: CAR-DISCOVERY-03.

### STORY-SUPPORT-01 — Lookup a draw dispute

**As a** support agent,
**I want** to look up a draw order and see related wallet entry, prize result, proof record, snapshot, and audit events,
**so that** I can answer customer disputes without engineering database access.

Acceptance criteria:
- Lookup supports draw order ID and user context.
- View shows wallet debit, prize outcomes, fairness proof ID, snapshot reference, and key timestamps.
- Support access is role-restricted and vendor-scoped where appropriate.
- Sensitive user/payment data is redacted unless the role explicitly requires it.
- Lookup access is audited.

Priority: MVP.
Related CARs: CAR-SUPPORT-01, CAR-TRUST-02.

### STORY-SUPPORT-02 — Explain or adjust a wallet balance safely

**As a** support or finance admin,
**I want** to inspect a customer wallet ledger and apply controlled credits/refunds when allowed,
**so that** balance issues can be resolved without mutable ledger edits.

Acceptance criteria:
- Support lookup shows ledger entries with related draw/top-up/return IDs.
- Manual credits/refunds require role permission, vendor scope, reason code, and audit log.
- Reversals are new immutable ledger entries, not edits or deletes.
- Cross-vendor access is blocked unless platform-admin scope is explicit.

Priority: MVP.
Related CARs: CAR-WALLET-02, CAR-SUPPORT-01.

### STORY-SECURITY-01 — Resist duplicate and scripted abuse

**As a** vendor operator,
**I want** draw and wallet flows protected from retries, scripted abuse, and duplicate exploitation,
**so that** campaigns do not create uncontrolled financial exposure.

Acceptance criteria:
- Idempotency replay is enforced for draws and return-to-points.
- Sensitive endpoints require auth and vendor scope.
- Basic rate limiting or equivalent abuse controls are defined for draw/funding endpoints before public launch.
- Rate-limit identity key, vendor scope, affected endpoints, and failure behavior are documented.
- Abuse-relevant events are auditable.

Priority: MVP.
Related CARs: CAR-SECURITY-01.

### STORY-RETENTION-01 — Preserve critical financial/proof records

**As a** platform operator,
**I want** draw results, proof records, wallet entries, and prize ownership records to be retained safely,
**so that** disputes, audits, and customer history remain valid.

Acceptance criteria:
- Wallet entries, draw orders/results, fairness proofs, and user prize records are not hard-deleted through normal user/admin flows.
- Archive/status fields are used where records must be hidden from normal views.
- Retention expectations are documented for financial/proof data.
- Admin destructive actions, if any, are explicitly blocked or require exceptional approval.

Priority: MVP.
Related CARs: CAR-TRUST-02, CAR-OPS-01.

### STORY-OPS-01 — Detect failed or stuck operational events

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

## Definition of ready for implementation tickets

A customer story is ready to turn into code tickets when:

- Persona and outcome are clear.
- Acceptance criteria identify API, web, data model, transaction, and auth boundaries.
- Vendor scope and user scope are explicit.
- Public versus internal/admin visibility is explicit.
- MVP versus roadmap status is explicit.
- Idempotency/concurrency behavior is explicit where financial or prize state changes.
- Any proof/fairness claim states exactly what is verifiable.
- Required env/deploy behavior is known.

## Definition of done for MVP stories

A story is done when:

- API behavior is implemented with existing repo conventions.
- Web behavior is implemented using existing CSS/style patterns.
- Prisma/data changes include seed or migration implications as needed.
- JWT auth and vendor scoping are tested where sensitive data is involved.
- Financial/prize state changes are idempotent or concurrency-safe as appropriate.
- `npm run build -w @oripa/api` passes.
- `npm run build -w @oripa/web` passes for web-facing changes.
- README is updated if env/config/runtime behavior changed.
- No unsupported roadmap feature is implied in UI copy.

# Oripa SaaS Customer Stories Deep Proposal

Purpose: turn the customer CAR research into an implementation-ready customer story proposal for `oripa_saas`.

This document is written for product planning and handoff to `@HRMcodingbot`. It avoids code changes and defines what should be built, in what order, and how each story should be accepted.

## Source base

- `docs/oripa-saas-customer-car-deep-research.md`
- `docs/oripa-saas-car-proposal-reviewed.md`
- `docs/oripa-saas-customer-stories-proposal.md`
- `docs/reference-clove-pokemon-deep-dive.md`
- Local repo inspection:
  - `apps/api/src/modules/wallet/router.ts`
  - `apps/api/src/modules/draws/router.ts`
  - `apps/api/src/modules/packs/router.ts`
  - `prisma/schema.prisma`

## Executive proposal

The first customer-story set should not try to build every Clove mechanic. It should prove one trustworthy Oripa loop:

`browse pack → inspect pack → authenticate → fund/seed wallet → draw safely → view result → verify proof → own prize → convert or request fulfillment → support can explain it`

The MVP is successful only when customers can answer these questions without support:

1. **What can I buy?** Pack list, tags, categories, price, stock, availability.
2. **What could I win?** Prize tiers, images, condition, quantities, return value where applicable.
3. **Can I draw safely?** Auth, wallet balance, eligibility, idempotency, no duplicate charge.
4. **Was the result fair?** Human-readable proof lookup linked from result/history.
5. **Where did my points go?** Private user-scoped wallet ledger.
6. **Where did my prize go?** Durable user prize inventory.
7. **What can I do next?** Convert eligible prizes to points or request admin-assisted fulfillment.
8. **Can support explain disputes?** Admin/support lookup ties draw, wallet, proof, inventory, and audit events together.

## Hard MVP guardrails

Do not mark a story complete if it violates these:

- **No wallet story is complete until `/v1/wallet` is authenticated and user-scoped.** Current code reads first wallet by vendor only.
- **No fairness story is customer-complete until a web proof page exists.** An API response alone is not enough for customer trust.
- **No prize-management story is complete until draw output becomes durable user prize inventory.** A transient result page is not ownership.
- **No paid-launch story is complete until one funding path is explicit.** Stripe, manual pilot credit, or another chosen provider.
- **No shipping claim is allowed unless the workflow actually handles address, selected prizes, fees/policy, status, and admin/operator action.** Until then, call it admin-assisted fulfillment.
- **No vendor self-service SaaS claim is allowed unless vendor roles, isolation, pack CRUD, publish validation, and audit exist.**

## Personas

### P1 — New Player

A first-time customer deciding if the site is safe enough to try.

Primary anxieties:

- Is this rigged?
- What am I buying?
- Will I get charged twice?
- What happens if I win?

### P2 — Returning Collector

A repeat customer browsing by card themes, budget, and chase intent.

Primary anxieties:

- Can I find packs I care about quickly?
- Are the prize lineups clear enough?
- Can I recycle low-value wins?
- Can I track my balance and prizes?

### P3 — High-Value / Slab Hunter

A customer willing to spend more if trust and fulfillment are credible.

Primary anxieties:

- Are premium prizes real and fulfillable?
- Are odds/tiers represented honestly?
- Can I verify and dispute outcomes?
- How does physical delivery work?

### P4 — Vendor Operator

A store/operator who wants to launch packs and campaigns without engineering work.

Primary anxieties:

- Can I publish packs safely?
- Can I merchandise by category/tag?
- Can I avoid overselling and support chaos?
- Can I see operational risk before customers complain?

### P5 — Platform Admin

Internal operator responsible for safe launch, tenant isolation, imports, settings, and production checks.

Primary anxieties:

- Can one vendor leak into another?
- Can bad pack data be blocked before publish?
- Can support resolve issues without database access?

### P6 — Support / Finance Ops

Internal team that resolves disputes and reconciles point/payment/prize states.

Primary anxieties:

- Can I explain a balance?
- Can I trace a draw result?
- Can I identify stuck outbox/payment/fulfillment failures?

## MVP story map

### Phase 0 — Trust and safety blockers

These must be fixed before public customer claims.

- STORY-00-01 — Authenticated user wallet scope.
- STORY-00-02 — Sensitive-action auth boundary.
- STORY-00-03 — Vendor isolation smoke tests.
- STORY-00-04 — One explicit funding mode.

### Phase 1 — Storefront discovery and pack clarity

- STORY-01-01 — Browse packs by category.
- STORY-01-02 — Filter by collector-intent tags.
- STORY-01-03 — Sort by purchase intent.
- STORY-01-04 — See pack availability and limits.
- STORY-01-05 — View prize-grade lineup.
- STORY-01-06 — Inspect card-level prize metadata.

### Phase 2 — Draw, result, and proof

- STORY-02-01 — Draw with idempotency protection.
- STORY-02-02 — Avoid oversold outcomes under concurrency.
- STORY-02-03 — View clear draw result.
- STORY-02-04 — Verify draw fairness after result.
- STORY-02-05 — Reopen result/proof history.

### Phase 3 — Wallet and prize lifecycle

- STORY-03-01 — View private wallet ledger.
- STORY-03-02 — See owned prize inventory.
- STORY-03-03 — Convert eligible prize to points.
- STORY-03-04 — Request admin-assisted physical fulfillment.

### Phase 4 — Admin, support, launch hardening

- STORY-04-01 — Controlled pack/prize import or admin creation.
- STORY-04-02 — Safe publish validation.
- STORY-04-03 — Manage categories/tags.
- STORY-04-04 — Support draw dispute lookup.
- STORY-04-05 — Support wallet/prize lookup.
- STORY-04-06 — Operational failure visibility.
- STORY-04-07 — Basic abuse controls.

## Detailed MVP stories

### STORY-00-01 — Authenticated user wallet scope

- **As a** player,
- **I want** wallet balance and ledger reads to show only my own wallet under the current vendor,
- **so that** my points are private and cannot leak to another customer.

Priority: **P0 blocker**.

Related CARs: CAR-06, CAR-WALLET-01, CAR-WALLET-02.

Evidence: `apps/api/src/modules/wallet/router.ts` currently uses vendor-only lookup.

Acceptance criteria:

- `/v1/wallet` requires JWT bearer auth.
- Wallet query filters by `vendorId + authenticated userId`.
- User A cannot read User B wallet under same vendor.
- Same user cannot read another vendor wallet unless explicitly scoped to that vendor and wallet exists.
- Response includes balance and recent ledger entries only for the authenticated user/vendor wallet.
- Tests cover unauthorized, wrong-user, wrong-vendor, and happy-path access.

Implementation notes:

- Reuse draw route JWT parsing or centralize auth middleware.
- Use the existing unique vendor/user wallet relation if present.
- Do not return `findFirst({ where: { vendorId } })`.

Done when:

- API test proves no cross-user wallet leakage.
- Web wallet UI does not render without auth.

### STORY-00-02 — Sensitive-action auth boundary

- **As a** player,
- **I want** all sensitive account actions to require sign-in,
- **so that** my balance, proofs, prizes, and draw history are tied to my account.

Priority: **P0 blocker**.

Related CARs: CAR-06, CAR-14.

Acceptance criteria:

- Draw, wallet, proof lookup, prize inventory, return-to-points, and fulfillment request endpoints require auth where user data is involved.
- Public browsing remains unauthenticated.
- Unauthenticated sensitive requests return a stable `AUTH_REQUIRED` or `401` response.
- Frontend has a clear sign-in path from blocked CTAs.
- JWT parsing is not copied inconsistently across modules if avoidable.

### STORY-00-03 — Vendor isolation smoke tests

- **As a** platform admin,
- **I want** every customer-sensitive route to enforce vendor scope,
- **so that** one tenant’s packs, wallets, prizes, and proofs cannot leak into another storefront.

Priority: **P0 blocker**.

Related CARs: CAR-14.

Acceptance criteria:

- Pack list/detail is vendor scoped.
- Wallet is vendor + user scoped.
- Draw order/proof lookup is vendor + user scoped.
- Prize inventory is vendor + user scoped.
- Admin/support lookup is role + vendor scoped.
- Tests include at least one cross-vendor denial per sensitive module.

### STORY-00-04 — One explicit funding mode

- **As a** player,
- **I want** a clear way to receive or purchase points,
- **so that** I can enter the draw loop without hidden manual steps.

Priority: **P0/P1 launch decision**.

Related CARs: CAR-07.

Acceptance criteria:

- Product mode is explicitly one of:
  - Stripe Checkout live top-up.
  - Manual/admin pilot credits.
  - Another chosen provider.
- UI copy matches the chosen mode.
- Funding success creates immutable wallet ledger credit.
- Failed/expired funding does not credit wallet.
- If pilot/manual mode, public copy does not say “buy points instantly.”

### STORY-01-01 — Browse packs by category

- **As a** player,
- **I want** to browse packs by category,
- **so that** I can quickly find Pokemon, One Piece, Yu-Gi-Oh, Weiss Schwarz, Hobby, Figure, or other product lanes.

Priority: **MVP**.

Related CARs: CAR-04.

Acceptance criteria:

- Pack list endpoint accepts category filter.
- Category navigation is represented in URL path or query state.
- Empty categories show a useful empty state.
- Category labels are vendor-configurable or at least stable and display-safe.
- Packs from other vendors never appear.

### STORY-01-02 — Filter by collector-intent tags

- **As a** collector,
- **I want** to filter packs by tags like PSA10, Charizard, BOX, Beginner Only, High Chance Profit, or Last One Bonus,
- **so that** I can shop by what I care about instead of scanning every pack.

Priority: **MVP**.

Related CARs: CAR-04.

Acceptance criteria:

- Tags are vendor-scoped.
- Tags have stable slug/id and display label.
- Optional tag fields support color/order/active state.
- Pack list endpoint accepts one or more tags.
- UI shows active filters and supports clearing them.
- Unsupported/deferred mechanics tags do not imply the mechanic exists unless configured.

### STORY-01-03 — Sort by purchase intent

- **As a** player,
- **I want** to sort packs by newest, recommended, price low-to-high, price high-to-low, and nearly sold out,
- **so that** I can browse by budget, urgency, or premium intent.

Priority: **MVP-lite**.

Related CARs: CAR-04.

Acceptance criteria:

- API supports newest and price ascending/descending at minimum.
- Recommended sort is deterministic and documented if included.
- Near-sold-out sort uses remaining/total stock where available.
- Sort works with category and tag filters.
- UI clearly displays current sort.

### STORY-01-04 — See pack availability and limits

- **As a** player,
- **I want** to see stock, timing, draw limits, and eligibility before pressing draw,
- **so that** I do not attempt unavailable packs.

Priority: **MVP**.

Related CARs: CAR-05.

Acceptance criteria:

- List/detail show sold-out status.
- Detail page shows total stock, remaining stock, open/close time where configured.
- CTA disabled state uses stable reasons: `SOLD_OUT`, `BEFORE_RELEASE`, `ENDED`, `AUTH_REQUIRED`, `LIMIT_REACHED`, `INSUFFICIENT_BALANCE`, `AVAILABLE`.
- Draw API enforces the same eligibility rules.
- Unsupported future gates are not silently shown as available.

### STORY-01-05 — View prize-grade lineup

- **As a** player,
- **I want** to see prize lineups grouped by grade/tier,
- **so that** I can understand chase prizes, mid-tier prizes, base prizes, and optional bonus groups before spending.

Priority: **MVP**.

Related CARs: CAR-03.

Acceptance criteria:

- Detail page groups displayed prizes by grade/tier.
- MVP supports FIRST/SECOND/THIRD/FOURTH or equivalent tier names where data exists.
- Optional groups render only when configured: EXTRA, ROUND_NUMBER, LAST_ONE, virtual tickets.
- UI copy does not imply unsupported bonus mechanics.

### STORY-01-06 — Inspect card-level prize metadata

- **As a** TCG collector,
- **I want** to see card image, name, condition, rarity/sub-description, card number/code, reference value, and displayed quantity,
- **so that** I can judge whether the pack is worth drawing.

Priority: **MVP**.

Related CARs: CAR-03.

Acceptance criteria:

- Prize card renders image, label, and fallback image/text.
- Optional condition, code, rarity, reference value, and appraised/slab status render if present.
- Missing optional metadata does not break layout.
- Operational fields not meant for pre-draw customers are not leaked.

### STORY-02-01 — Draw with idempotency protection

- **As a** player,
- **I want** a draw action to charge points only once even if my browser retries,
- **so that** I do not lose extra points from double-clicks or network issues.

Priority: **MVP**.

Related CARs: CAR-02.

Acceptance criteria:

- Draw endpoint requires `x-idempotency-key`.
- Same user/vendor/key replay returns original response.
- Conflicting replay under same key is rejected or safely handled.
- Wallet debit, stock decrement, draw result, fairness proof, and audit log are atomic.
- Tests verify one debit for repeated request.

Repo status:

- `draws/router.ts` already has idempotency-key logic; needs tests/verification and frontend integration.

### STORY-02-02 — Avoid oversold outcomes under concurrency

- **As a** player,
- **I want** the platform to produce only valid, fulfillable outcomes during high traffic,
- **so that** I do not win a prize the vendor cannot provide.

Priority: **MVP**.

Related CARs: CAR-02, CAR-13.

Acceptance criteria:

- Draw transaction decrements pack/prize stock safely.
- Failed stock check rolls back wallet debit and result creation.
- Concurrency/load test proves no negative pack stock and no negative prize stock.
- Errors are customer-readable and do not leak internals.

Repo status:

- `draws/router.ts` uses serializable transaction; still needs explicit concurrency tests.

### STORY-02-03 — View clear draw result

- **As a** player,
- **I want** my result page to clearly show what I won,
- **so that** I can understand normal prizes and supported bonus/result groups immediately.

Priority: **MVP**.

Related CARs: CAR-03, CAR-08.

Acceptance criteria:

- Result response includes won prize metadata required by UI.
- Result page survives refresh/direct navigation by draw order ID.
- MVP result includes normal prize group.
- Optional groups are empty/absent unless supported.
- Result links to proof lookup and prize inventory.

### STORY-02-04 — Verify draw fairness after result

- **As a** player,
- **I want** a proof page for each paid draw,
- **so that** I can verify the platform did not alter the outcome after payment.

Priority: **MVP**.

Related CARs: CAR-01.

Acceptance criteria:

- Each paid draw has linked fairness proof record.
- Proof page shows plain-English verification steps.
- Proof includes server seed hash, revealed seed, client seed, nonce, pool snapshot hash, selected ranges, and chosen prize IDs where safe.
- Proof lookup is user + vendor scoped.
- Page avoids implying external audit/certification.

Repo status:

- Backend proof endpoint exists in `draws/router.ts`; customer web UX still required.

### STORY-02-05 — Reopen result and proof history

- **As a** returning player,
- **I want** to revisit previous draw results and proofs,
- **so that** I can review wins, verify old outcomes, and contact support with IDs.

Priority: **MVP-light**.

Related CARs: CAR-01, CAR-12.

Acceptance criteria:

- Account page lists recent draw orders.
- Each order links to result and proof.
- Results/proofs are scoped to authenticated user/vendor.
- Support IDs are copyable.

### STORY-03-01 — View private wallet ledger

- **As a** player,
- **I want** to see my balance and recent point movements,
- **so that** I can understand top-ups, draw debits, returns, refunds, and adjustments.

Priority: **MVP** after STORY-00-01.

Related CARs: CAR-06.

Acceptance criteria:

- Wallet page shows current balance.
- Ledger rows show type, amount, timestamp, reason, and related draw/prize/payment ID where available.
- Ledger is append-only for customer-visible financial events.
- User cannot see another user’s ledger.

### STORY-03-02 — See owned prize inventory

- **As a** player,
- **I want** prizes I win to appear in my account inventory,
- **so that** I can manage them after leaving the draw result page.

Priority: **MVP**.

Related CARs: CAR-08.

Acceptance criteria:

- Successful draw creates user prize inventory records.
- Inventory is user + vendor scoped.
- Inventory shows image/name/condition/status/source draw.
- Refreshing result/account does not lose prize ownership state.
- Inventory state distinguishes owned, converted, fulfillment requested, fulfilled, canceled/adjusted.

### STORY-03-03 — Convert eligible prize to points

- **As a** player,
- **I want** to convert eligible prizes back into points,
- **so that** I can keep drawing instead of shipping low-value or duplicate cards.

Priority: **MVP** if prize inventory exists.

Related CARs: CAR-09.

Acceptance criteria:

- Eligible prizes display return amount before action.
- Conversion creates wallet credit ledger entry.
- Converted prize cannot be converted twice.
- Converted prize cannot be shipped after conversion.
- Ineligible/shipping-only prizes clearly explain why conversion is unavailable.
- Operation is atomic and auditable.

### STORY-03-04 — Request admin-assisted physical fulfillment

- **As a** player,
- **I want** a clear way to request physical fulfillment for eligible prizes,
- **so that** I can receive valuable cards even before full self-serve shipping exists.

Priority: **MVP if physical prizes are sold; otherwise roadmap**.

Related CARs: CAR-10.

Acceptance criteria:

- Eligible physical prizes show fulfillment option or support instruction.
- Request changes inventory status to fulfillment requested/reserved.
- Customer sees current fulfillment status.
- Admin/support can see requested items.
- UI copy says admin-assisted if address/fee/label automation is not implemented.

### STORY-04-01 — Controlled pack/prize import or admin creation

- **As a** platform admin,
- **I want** to create or import packs and prize lineups through a controlled workflow,
- **so that** real packs can launch without unsafe direct database edits.

Priority: **MVP admin**.

Related CARs: CAR-11, CAR-14.

Acceptance criteria:

- Admin/import flow creates vendor-scoped packs and prizes.
- Import errors identify exact bad rows/fields.
- Required fields are validated before save/publish.
- Unauthorized users cannot create cross-tenant pack data.
- Pack creation is audited.

### STORY-04-02 — Safe publish validation

- **As a** platform admin,
- **I want** the system to block unsafe pack publishing,
- **so that** customers do not see broken packs, impossible stock, or misleading prize pages.

Priority: **MVP admin**.

Related CARs: CAR-11.

Acceptance criteria:

- Draft packs can be incomplete.
- Published packs require title, price, stock, prize rows, valid weights, images or fallbacks, displayable tiers, and timing validity.
- Prize stock/pack stock consistency is checked.
- Return amount exists for convertible prizes.
- Publish validation returns field-level errors.
- Publish action is audited.

### STORY-04-03 — Manage categories and tags

- **As a** vendor operator or platform admin,
- **I want** to manage category and tag metadata,
- **so that** storefront discovery matches how customers shop.

Priority: **MVP admin**.

Related CARs: CAR-04.

Acceptance criteria:

- Tags/categories are vendor-scoped.
- Admin can assign them to packs.
- Tags can be disabled without breaking existing pack pages.
- Display order and badge label are controllable.
- Deletion/renaming behavior is documented.

### STORY-04-04 — Support draw dispute lookup

- **As a** support agent,
- **I want** to look up a draw order and see wallet debit, prize result, proof record, and audit events,
- **so that** I can answer customer disputes without asking engineering to query the database.

Priority: **MVP support**.

Related CARs: CAR-12.

Acceptance criteria:

- Lookup supports draw order ID and user context.
- View shows wallet debit, draw results, proof ID, timestamp, request ID, and status.
- Access is role-restricted and vendor-scoped.
- Lookup does not expose unrelated user data.
- Support lookup is itself audited.

### STORY-04-05 — Support wallet/prize lookup

- **As a** support agent,
- **I want** to inspect a customer wallet ledger and prize inventory,
- **so that** I can explain balances, returns, fulfillment status, and adjustments.

Priority: **MVP support**.

Related CARs: CAR-06, CAR-08, CAR-12.

Acceptance criteria:

- Lookup shows ledger entries with related draw/payment/prize IDs.
- Lookup shows inventory status history.
- Cross-vendor access is denied unless platform-admin scope is explicit.
- Adjustments are new ledger/status entries, not silent edits.

### STORY-04-06 — Operational failure visibility

- **As a** finance/ops user,
- **I want** failed payments, stuck outbox events, draw anomalies, and fulfillment failures to be visible,
- **so that** I can fix issues before they become customer disputes.

Priority: **MVP-light / early roadmap**.

Related CARs: CAR-12, CAR-13.

Acceptance criteria:

- Outbox/worker failures are logged with request/vendor IDs.
- Payment/draw/prize status transitions are inspectable.
- Reconciliation mismatches have an operational signal.
- Alerting can be deferred, but the data needed for alerting is captured.

### STORY-04-07 — Basic abuse controls

- **As a** vendor operator,
- **I want** draw and wallet flows protected from retries, scripted abuse, and duplicate-account exploitation,
- **so that** campaigns do not create uncontrolled financial exposure.

Priority: **MVP security**.

Related CARs: CAR-13.

Acceptance criteria:

- Draw idempotency replay is enforced.
- Sensitive endpoints require auth and vendor scope.
- Basic rate limiting or equivalent abuse protection is defined for draw/funding endpoints before public launch.
- Abuse-relevant events are auditable.
- New-user/coupon/daily mechanics are deferred until this foundation exists.

## Roadmap stories — explicitly not MVP claims

### STORY-R-01 — Demo gacha

- **As a** new player,
- **I want** to try a clearly labeled demo draw,
- **so that** I can understand the experience before spending points.

Roadmap guardrail: demo must be clearly non-real unless tied to actual pack odds and must not consume real inventory.

### STORY-R-02 — Self-serve shipping

- **As a** player,
- **I want** to select prizes, choose an address, see fees/requirements, and request shipment,
- **so that** I can redeem physical prizes without contacting support.

Roadmap guardrail: only claim once address CRUD, shipping fee/policy checks, selected-prize fulfillment, and status tracking exist.

### STORY-R-03 — Multiple payment providers

- **As a** player,
- **I want** to choose from supported local payment methods,
- **so that** I can top up using a provider I trust.

Roadmap guardrail: start with one funding path. Defer PayPay/GMO/local wallet expansion.

### STORY-R-04 — Coupons and promotion codes

- **As a** player,
- **I want** to redeem campaign codes or point coupons,
- **so that** I can participate in vendor promotions.

Roadmap guardrail: defer until abuse controls, ledger semantics, and support lookup are strong.

### STORY-R-05 — New-user and daily gated packs

- **As a** player,
- **I want** special packs for first-time or daily return visits,
- **so that** I have a clear reason to start and come back.

Roadmap guardrail: depends on centralized eligibility and anti-abuse controls.

### STORY-R-06 — Rank-limited packs

- **As a** loyal player,
- **I want** access to packs based on rank,
- **so that** continued engagement unlocks better opportunities.

Roadmap guardrail: manual/admin-assigned rank gate can come before rank progression. Do not imply automatic loyalty progression until built.

### STORY-R-07 — Last-one, round-number, and extra prizes

- **As a** player,
- **I want** special bonus mechanics to be clearly explained,
- **so that** I understand urgency and milestone opportunities.

Roadmap guardrail: draw response may stay extensible, but public bonus claims require implemented eligibility/result logic.

### STORY-R-08 — RUSH / virtual ticket loop

- **As a** player,
- **I want** virtual ticket prizes to unlock follow-on draws,
- **so that** the platform has deeper progression beyond one-off packs.

Roadmap guardrail: later virtual-prize economy. Not MVP.

### STORY-R-09 — Notifications

- **As a** player,
- **I want** notifications for prize wins, payment status, fulfillment status, and expiring offers,
- **so that** I do not miss important account actions.

Roadmap guardrail: event modeling can start early; delivery claims require real email/SMS/push implementation.

## Acceptance criteria template for future tickets

Each engineering ticket derived from these stories should include:

- Story ID.
- Persona.
- User outcome.
- Related CAR ID.
- API endpoints affected.
- Web routes/components affected.
- Prisma/data model impact.
- Auth scope: public, user-auth, vendor-admin, platform-admin, support.
- Vendor scope behavior.
- Error/reason codes.
- Tests required.
- Public copy allowed / claims forbidden.
- Rollback or migration concerns.

## Recommended implementation order

1. STORY-00-01 — Authenticated user wallet scope.
2. STORY-00-02 — Sensitive-action auth boundary.
3. STORY-00-03 — Vendor isolation smoke tests.
4. STORY-00-04 — One explicit funding mode.
5. STORY-02-01 — Draw with idempotency protection verification.
6. STORY-02-02 — Concurrency/stock safety tests.
7. STORY-02-04 — Proof page UX.
8. STORY-01-04 — Availability and eligibility reason codes.
9. STORY-01-01/02/03 — Category, tags, sort storefront.
10. STORY-01-05/06 — Prize-grade lineup and metadata.
11. STORY-02-03/05 — Result page and history.
12. STORY-03-02 — User prize inventory.
13. STORY-03-01 — Wallet ledger UI.
14. STORY-03-03 — Convert-to-points.
15. STORY-03-04 — Admin-assisted fulfillment if physical prizes are sold.
16. STORY-04-01/02/03 — Admin import/create, publish validation, categories/tags.
17. STORY-04-04/05 — Support lookup.
18. STORY-04-06/07 — Operational visibility and abuse controls.
19. Roadmap mechanics only after stable MVP loop.

## Definition of ready

A story is ready for implementation when:

- Persona, user outcome, and business outcome are clear.
- Required auth/vendor/user scope is explicit.
- MVP vs roadmap status is clear.
- Required API and UI surfaces are named.
- Acceptance criteria include failure states, not only happy path.
- Any public claim is tied to a feature that will actually ship.
- Any legal/compliance-sensitive wording is conservative or routed for review.

## Definition of done

A story is done when:

- API behavior is implemented and tested.
- Web behavior is implemented and matches copy constraints.
- Prisma/data changes include migration/seed implications if needed.
- JWT and vendor scoping tests pass for sensitive paths.
- Relevant build/test commands pass.
- Docs or README are updated if env/runtime behavior changes.
- No deferred roadmap feature is implied in customer copy.

## Customer-copy boundaries from these stories

Safe MVP copy after stories are complete:

> Browse TCG mystery packs by category and collector tags, review prize lineups before drawing, draw with retry-safe wallet protection, verify each paid result with a fairness record, and manage eligible wins from your account.

Unsafe until later:

- Fully automated shipping.
- Multiple payment methods.
- Insured/vaulted custody.
- Vendor self-service SaaS at full scale.
- New-user/daily/rank/RUSH mechanics.
- Certified/audited fairness.
- Exact odds if exact odds are not product-policy supported.

## Confidence

- Story map fit to CAR research: **high, 0.88**.
- MVP boundary correctness: **high, 0.85**, because it follows the Oracle conditional-approve constraints.
- Local repo blocker identification: **high, 0.93** for wallet scoping.
- Roadmap phasing: **medium-high, 0.78**, because payment/fulfillment/compliance choices may change business priorities.

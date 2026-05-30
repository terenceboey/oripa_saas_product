# Oripa SaaS Core CAR and Customer Stories — Shared Requirements Extracted from Clove, Phygitals, and Collector Crypt

Source references:
- `docs/reference-clove-pokemon-deep-dive.md`
- `docs/reference-phygitals-deep-dive.md`
- `docs/reference-collectorcrypt-deep-dive.md`
- `docs/oripa-saas-car-proposal-reviewed.md`
- `docs/oripa-saas-customer-stories-reviewed.md`
- Oracle review: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/oripa-saas-phygitals-collectorcrypt-proposals-review-1.md`

Status: Oracle revision pass 2 applied.

## Purpose

This file extracts the shared Oripa SaaS requirements that are strengthened by multiple references. Site-specific proposal files should not duplicate these requirements; they should cite these core CARs and add only the reference-specific patterns.

## Launch-safety ordering

### P0 / launch-safety critical

- Authenticated user, vendor, and tenant scoping for every wallet, draw, pack, prize, support, and admin endpoint.
- Points wallet ledger with idempotent debit/credit operations and non-negative balance enforcement.
- Atomic paid draw transaction: debit wallet, select prize, reserve/award inventory, create result, create proof/snapshot, and create user prize record in one committed unit.
- Pack pool snapshot and draw configuration versioning.
- Minimal publish validation for price, active stock, draw weights, tenant scope, active prize inventory, and proof/snapshot generation.
- User prize / prize entitlement status machine.
- Support trace from wallet debit to draw result, proof, inventory, return, and fulfillment.
- Pack operational status and emergency stop.
- Fulfillment request foundation if physical prizes can be won at launch.
- Return-to-points only if the storefront/result UI advertises return eligibility at launch; otherwise hide return copy until implemented.

### P1 / near-MVP trust and merchandising

- Category-led pack discovery.
- Pack family/tier ladder.
- Structured prize metadata and reference value display.
- Safe pack detail disclosure.
- Featured/top-hit showcase with availability-safe copy.
- Value-band disclosure only if snapshot-backed and publish-validated.
- Admin preview and field-specific publish validation UX.
- Public result projection only after privacy policy and support trace are ready.

### P2 / growth after draw/inventory stability

- Spice/risk variants.
- Demo spin.
- Expected value display/computation.
- Advanced privacy controls.
- Customer-facing proof detail page polish.
- Pack vouchers/open-later flows if product wants gifts/promos/bundles.
- Free spins only after anti-abuse controls or if demo-only.

### Roadmap / explicit non-goals for MVP

- Marketplace.
- Peer trading.
- User-to-user transfers.
- Self-serve shipping automation.
- Gifts.
- Multi-pack/Yolo/party opens.
- Leaderboards.
- Vault tokenization.
- Web3 wallet login.
- NFTs/Solana/Coinflow/Moonpay.
- Collateralized loans.

## Copy safety vocabulary

Use these safe replacements unless the underlying capability and legal/product policy are implemented:

- Replace “owned asset” with “user prize record” or “prize entitlement.”
- Replace “real ownership” with “durable inventory record, subject to Oripa’s custody and fulfillment terms.”
- Replace “cash buyback” with “return eligible prize to points.”
- Replace “instant buyback” with “return-to-points, if eligible.”
- Replace “insured value” with “reference value,” unless insured custody is approved.
- Replace “vaulted” with “held in platform/vendor custody,” only if true.
- Replace “authenticated/scanned” with “grade/certification metadata recorded,” unless Oripa verifies authentication/scanning.
- Replace “live odds” with “configured value bands,” unless computed from active pool snapshot.
- Replace “expected value” with “expected value shown only under approved EV policy.”
- Replace “top items available in this pack” with “featured possible pulls,” “examples,” or “currently available featured pulls” depending on display mode.

## Shared CARs

### CORE-CAR-01 — Authenticated tenant/user scoping

- **Challenge:** Multi-tenant oripa systems can leak wallet, draw, prize, or support data if endpoints are only vendor-scoped or unauthenticated.
- **Action:** Enforce authenticated user + vendor scope on every sensitive endpoint and admin/support role scope on privileged reads/writes.
- **Result:** Customers only see their own wallet, draws, prize records, returns, and fulfillment requests; vendors cannot access other tenants.
- **Priority:** P0.
- **Acceptance:** Cross-tenant and cross-user access attempts fail for category, pack, prize, wallet, draw, inventory, support, feed, and admin routes.

### CORE-CAR-15 — Points wallet ledger invariants

- **Challenge:** Customers can be overcharged, overspend, or receive duplicate credits if wallet balance is not derived from an idempotent, auditable ledger with concurrency protection.
- **Action:** Model wallet balance through scoped wallet ledger entries with vendorId, userId, amount, entry type, source record, idempotency key, balanceAfter or reconciliation support, and audit timestamps. Enforce non-negative balance and serializable/concurrency-safe debits.
- **Result:** Every points movement is traceable, duplicate-safe, and supportable.
- **Priority:** P0.
- **Acceptance:** Insufficient-balance debit fails before prize selection; two concurrent draw attempts cannot spend the same points; duplicate debit/credit/return/admin adjustment requests do not create duplicate ledger entries; every ledger entry is user/vendor scoped and linked to its source; balance cannot go negative; support can reconcile balance from ledger entries.

### CORE-CAR-02 — Atomic paid draw ledger/result/proof/inventory transaction

- **Challenge:** A paid draw can fail halfway, double-charge, or award no prize if wallet debit, selection, result, proof, and inventory are not atomic.
- **Action:** Execute paid draws in one serializable/idempotent transaction that debits points, selects prize, reserves/awards inventory item, creates draw order/result, creates fairness/disclosure snapshot, and creates user prize record.
- **Result:** Customers never lose points without a traceable prize entitlement and proof snapshot.
- **Priority:** P0.
- **Acceptance:** Duplicate draw request with same idempotency key does not double-debit; failures roll back all side effects; stock depletion between page load and purchase fails safely.

### CORE-CAR-03 — Pack pool snapshot and draw configuration versioning

- **Challenge:** Odds, value bands, EV, and support disputes become unresolvable if pack configuration mutates after a customer draws.
- **Action:** Version pack configuration and snapshot active prize pool, weights, value bands, return policy, and draw algorithm inputs at draw time.
- **Result:** Support and customers can verify what rules applied to a specific draw.
- **Priority:** P0 if disclosures are shown; otherwise P1.
- **Acceptance:** DrawResult references immutable config/disclosure snapshot; support can compare current vs draw-time configuration.

### CORE-CAR-16 — Fair draw selection and auditable proof record

- **Challenge:** Paid draws are not supportable or trustworthy if the system cannot prove which pool, weights, item states, and draw algorithm were used to select the awarded prize.
- **Action:** Version the draw algorithm and record the auditable draw inputs: pack version, active pool snapshot, item eligibility, weights, random source/seed or proof material, idempotency key, selected prize/item, and algorithm version. Expose only customer-safe proof fields publicly.
- **Result:** Support can replay or audit the draw decision without exposing security-sensitive internals.
- **Priority:** P0.
- **Acceptance:** Draw selection only considers eligible AVAILABLE inventory in the draw-time snapshot; zero-weight, removed, locked, reserved, or awarded items cannot be selected; duplicate idempotency key returns the same result and does not rerun randomness; proof/audit record links to drawResultId and userPrizeId; customer-facing proof hides seed/security internals while support/admin access is role-gated.

### CORE-CAR-04 — User prize / prize entitlement inventory

- **Challenge:** Draw results that are not durable records cannot support returns, fulfillment, support, or future marketplace features.
- **Action:** Add user prize record for every awarded prize with vendorId, userId, drawOrderId, drawResultId, prizeId/itemId, current status, and audit timestamps.
- **Result:** Customers can revisit prize entitlements and operators can manage their lifecycle.
- **Priority:** P0.
- **Acceptance:** Every successful paid draw creates exactly one user prize record; awarded items cannot be awarded again; user inventory is authenticated and user-scoped.

### CORE-CAR-05 — Return-to-points policy and ledger credit

- **Challenge:** Customers need a liquidity path for eligible prizes, but repeated or unauthorized returns can corrupt balances.
- **Action:** Implement explicit return policy and idempotent return-to-points transaction that credits wallet and transitions user prize status.
- **Result:** Eligible prizes can be converted safely without manual support.
- **Priority:** P0/P1 if advertised; hide if not implemented.
- **Acceptance:** Duplicate return does not double-credit; returned prize cannot be fulfilled; ledger entry references userPrizeId and drawOrderId.

### CORE-CAR-06 — Physical fulfillment request foundation

- **Challenge:** Physical prizes require address/PII handling, eligibility, locking, support workflow, and final-state rules.
- **Action:** Add admin-assisted fulfillment request lifecycle before full self-serve shipping automation.
- **Result:** Physical winners can be handled operationally without overbuilding logistics.
- **Priority:** P0 if physical fulfillment is promised.
- **Acceptance:** Starting fulfillment locks return-to-points; fulfilled prize cannot be returned; address/PII is access-controlled; unsupported countries are blocked or routed to support; fulfilled, returned, locked, removed, or non-owned prizes cannot create new fulfillment requests. If physical fulfillment is not implemented at launch, customer UI and pack copy must not promise shipment, delivery, redemption, or physical claim actions.

### CORE-CAR-07 — Publish-time draw safety validation

- **Challenge:** Misconfigured packs can accept money while empty, invalid, or unverifiable.
- **Action:** Validate active stock, positive price, valid weights, non-empty prize pool, tenant scope, operational status, return policy, and proof/snapshot generation before publish.
- **Result:** Customers cannot draw from unsafe packs.
- **Priority:** P0.
- **Acceptance:** Publish fails when draw weights are invalid, active pool is empty, removed/locked items are in active pool, value-band weights do not total 10000 bps, or snapshot generation fails.

### CORE-CAR-08 — Support trace across money, draw, proof, inventory, return, fulfillment

- **Challenge:** Support cannot resolve disputes without a single trace across customer money flow and prize lifecycle.
- **Action:** Build support lookup by user, order, draw result, proof, userPrize, public feed ID, or wallet ledger entry.
- **Result:** Support can answer what happened to points/prize without database spelunking.
- **Priority:** P0.
- **Acceptance:** Every support lookup is audited; lookup enforces vendor scope and role permissions; PII and security fields are redacted unless role allows them.

### CORE-CAR-09 — Public result projection with privacy controls

- **Challenge:** Recent-pulls/winners feeds build trust but can leak customer identity or behavior.
- **Action:** Create public result projections with vendor/pack scope, redaction, visibility controls, and traceability to internal records.
- **Result:** Storefront can show social proof safely.
- **Priority:** P1/P2.
- **Acceptance:** Public feed is anonymous by default; user-identifiable display requires consent; support/admin can hide a projection; hidden projections remain internally auditable.

### CORE-CAR-10 — Customer-facing claim safety policy

- **Challenge:** Words like “live odds,” “EV,” “buyback,” “cash back,” “insured,” “vault,” “authenticated,” and “owned” can create legal or trust risk.
- **Action:** Add claim categories and publish-time copy validation.
- **Result:** Oripa only displays claims backed by implemented capabilities and approved policy.
- **Priority:** P0/P1.
- **Acceptance:** “Live odds” requires computed active-pool odds; “EV” requires approved EV policy; “cash buyback” requires payout capability; “insured” requires insurance policy; “vault” requires custody process; “owned” requires approved legal title terms.

### CORE-CAR-11 — Pack operational status and emergency stop

- **Challenge:** Customers must not spend points on unavailable, empty, paused, or misconfigured packs.
- **Action:** Add explicit pack operational statuses and admin emergency stop controls.
- **Result:** Operators can pause draws and customers see accurate availability.
- **Priority:** P0.
- **Acceptance:** Pack status supports DRAFT, ACTIVE, PAUSED, OUT_OF_STOCK, ARCHIVED; paused/out-of-stock packs cannot be drawn; in-flight draw behavior is deterministic; status changes are audited.

### CORE-CAR-12 — Draw-time disclosure snapshot

- **Challenge:** Customers and support need to know exactly what was displayed when the customer purchased.
- **Action:** Snapshot price, pack version, value bands, EV, return policy, top-hit display mode, prize metadata, and claim copy at draw time.
- **Result:** Disputes can be resolved without relying on mutable current configuration.
- **Priority:** P0 if disclosures are shown; otherwise P1.
- **Acceptance:** DrawResult references immutable disclosure snapshot; support can compare current vs draw-time configuration; customer proof page shows approved customer-safe snapshot fields.

### CORE-CAR-13 — Specific physical inventory item state

- **Challenge:** Stock counts alone cannot prevent double-awards or manage physical prize fulfillment.
- **Action:** Track prize item state: AVAILABLE, RESERVED, AWARDED, RETURNED, FULFILLMENT_PENDING, FULFILLED, REMOVED, LOCKED.
- **Result:** Physical inventory stays accurate across draws, returns, and fulfillment.
- **Priority:** P0/P1 depending on item-level inventory maturity.
- **Acceptance:** Awarded items cannot be awarded again; removed/locked items cannot enter active draw pools; state transitions are role-gated and audited.

### CORE-CAR-14 — Identity future-proofing without web3 dependency

- **Challenge:** Future wallet/social identity support should not make current draw and prize records depend on mutable external identifiers.
- **Action:** Keep User as canonical owner and model optional LinkedIdentity records later.
- **Result:** Oripa remains simple now and extensible later.
- **Priority:** Design constraint.
- **Acceptance:** Draw, wallet ledger, UserPrize, support, and fulfillment records key ownership to userId; unlinking an identity cannot orphan records.

## Shared customer stories

### STORY-CORE-SCOPE-01 — Enforce scoped sensitive reads
As a customer, I want my wallet, draws, prize records, returns, and fulfillment requests visible only to me so that my account is private and safe.

Acceptance criteria:
- All sensitive endpoints require authentication.
- Vendor and user scope are both enforced.
- Cross-user/cross-vendor attempts return safe errors.
- Tests cover wallet, inventory, draw history, support, and public feed boundaries.

### STORY-CORE-WALLET-01 — Prevent overspend and duplicate wallet entries
As a customer, I want my points balance to be accurate under retries, returns, and concurrent opens so that I am never overcharged or double-credited.

Acceptance criteria:
- Debit fails safely when balance is insufficient.
- Concurrent paid draws cannot both consume the same points.
- Duplicate debit, credit, return, or admin adjustment requests are idempotent.
- Every wallet movement has a ledger entry with source, user, vendor, and audit metadata.
- Support can trace balance changes without manual database inspection.

### STORY-CORE-DRAW-01 — Complete paid draw safely
As a customer, I want a paid draw to debit points, award a prize, create proof, and create an inventory record atomically so that retries or failures cannot lose my points.

Acceptance criteria:
- Idempotency key is required for paid draw.
- Duplicate request returns same result or safe conflict without double debit.
- Wallet debit, prize award, proof, snapshot, and user prize commit together.
- Failed draw rolls back all side effects.

### STORY-CORE-FAIR-DRAW-01 — Audit how my prize was selected
As support, I want each paid draw to have an auditable selection record so that disputes about fairness, weights, or prize eligibility can be resolved.

Acceptance criteria:
- Draw result stores pack version, pool snapshot, algorithm version, selected item, and proof/audit reference.
- Ineligible inventory states cannot be selected.
- Duplicate draw retries do not rerun selection.
- Support can inspect audit-safe proof details.
- Customer-facing proof excludes internal seed/security fields.

### STORY-CORE-SNAPSHOT-01 — Support sees draw-time customer disclosure
As support, I want to see the exact pack disclosure shown at purchase time so that I can resolve disputes about odds, EV, value, return policy, or top hits.

Acceptance criteria:
- Support view shows draw-time price, pack version, disclosure, return policy, and prize metadata snapshot.
- Current configuration is shown separately.
- Sensitive proof internals are role-gated.
- Lookup itself writes audit event.

### STORY-CORE-INVENTORY-01 — Customer sees prize entitlement inventory
As a customer, I want to see all prize records awarded to me so that I know what I can return, fulfill, or keep.

Acceptance criteria:
- Inventory item shows prize image/name/status/source pack/draw time.
- Inventory is authenticated and user-scoped.
- Status derives from state machine.
- Returned/fulfilled/locked states are visible with safe copy.

### STORY-CORE-INVENTORY-ITEM-01 — Admin manages specific physical item status
As an operator, I want to manage the status of a specific physical prize item so that stock, awards, returns, and fulfillment stay accurate.

Acceptance criteria:
- Admin can see AVAILABLE, RESERVED, AWARDED, RETURNED, FULFILLMENT_PENDING, FULFILLED, REMOVED, and LOCKED states.
- Status transitions are role-gated.
- Awarded items cannot be awarded again.
- Removed/locked items cannot appear in active draw pools.

### STORY-CORE-RETURN-FULFILL-EXCLUSION-01 — Return and fulfillment are mutually exclusive
As a customer, I want return and fulfillment actions to be clear and mutually exclusive so that I do not accidentally lose a prize or points.

Acceptance criteria:
- Starting fulfillment locks return-to-points.
- Returning to points disables fulfillment.
- Cancelled/rejected fulfillment restores eligible actions only if policy allows.
- Customer sees status and reason.

### STORY-CORE-FULFILLMENT-01 — Request physical prize fulfillment safely
As a customer, I want to request fulfillment for an eligible physical prize so that I can receive it without losing return eligibility accidentally or exposing unnecessary personal data.

Acceptance criteria:
- Fulfillment can be requested only for an authenticated user’s eligible userPrize.
- Request creation is idempotent and links to userPrizeId, drawOrderId, drawResultId, and vendorId.
- Starting fulfillment locks return-to-points.
- Fulfillment request supports customer-safe statuses such as REQUESTED, NEEDS_INFO, IN_REVIEW, APPROVED, SHIPPED, FULFILLED, CANCELLED, and REJECTED.
- Unsupported countries/regions are blocked or routed to support before final submission.
- Address and PII fields are role-gated, redacted in normal support views, and audited on access.
- Fulfilled, returned, locked, removed, or non-owned prizes cannot create new fulfillment requests.

### STORY-CORE-PACK-STATUS-01 — Customer sees unavailable pack safely
As a customer, I want unavailable packs to be clearly disabled so that I do not spend points on a pack that cannot be opened.

Acceptance criteria:
- Paused, archived, and out-of-stock packs cannot be purchased.
- UI shows customer-safe reason.
- API rejects draw attempts for unavailable packs.
- Admin status changes are audited.

### STORY-CORE-CLAIMS-01 — Admin cannot publish unsupported claim copy
As an operator, I want unsupported claims blocked before publish so that customer-facing pack pages remain accurate.

Acceptance criteria:
- “Live odds,” “EV,” “cash buyback,” “insured,” “vault,” “authenticated,” and “owned” claims are validated against enabled capabilities.
- Validation error explains required capability or safer replacement copy.
- Admin preview shows final customer copy.

### STORY-CORE-PRIVACY-01 — Hide my public pull
As a customer, I want my pull hidden from public feeds unless the platform policy clearly allows anonymized display.

Acceptance criteria:
- Public feed is anonymous by default.
- User-identifiable display requires consent.
- Support/admin can hide a projection.
- Hidden projections no longer appear publicly but remain internally auditable.

### STORY-CORE-SUPPORT-01 — Trace money-to-prize lifecycle
As support, I want one scoped lookup that connects wallet entries, draw orders, proof snapshots, prize records, return events, and fulfillment requests so that I can resolve disputes fast.

Acceptance criteria:
- Lookup supports user ID, order ID, draw ID, proof ID, userPrize ID, and public projection ID.
- Lookup is role/vendor scoped.
- Every lookup is audited.
- PII and proof/security internals are redacted by role.

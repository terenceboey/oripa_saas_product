# Collector Crypt-Derived CAR and Customer Stories Proposal for Oripa SaaS — Oracle Revised

Source reference: `docs/reference-collectorcrypt-deep-dive.md`
Supplemental source: https://docs.collectorcrypt.com/gacha/api
Shared core: `docs/oripa-core-car-and-customer-stories.md`
Oracle review applied: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/oripa-saas-phygitals-collectorcrypt-proposals-review-1.md`

## Verdict after revision pass 1

Collector Crypt should influence Oripa SaaS mainly at the prize-entitlement, custody, support, buyback/return, and future marketplace/voucher layers. It strongly validates the importance of a durable user prize record and lifecycle trace, but Oripa SaaS must avoid web3/payment/loan claims until those capabilities are explicitly approved and implemented.

## What Collector Crypt uniquely contributes

- Physical collectibles managed as digital records tied to profile/wallet.
- Vault/custody/authentication/scanning/reference value patterns.
- Gacha pack purchase/open flow and pack machine status semantics.
- Buyback and auto-sell/turbo style mechanics.
- Purchased/gifted pack/open-later flows.
- Recent/all winners feeds.
- API-level machine errors: empty machine, too many packs open, emergency stop active.
- Rarity odds/pack status patterns.

## Strengthened shared core CARs

Collector Crypt evidence strengthens these shared requirements:

- `CORE-CAR-02` — atomic paid draw ledger/result/proof/inventory transaction.
- `CORE-CAR-04` — user prize / prize entitlement inventory.
- `CORE-CAR-05` — return-to-points policy and ledger credit.
- `CORE-CAR-06` — physical fulfillment request foundation.
- `CORE-CAR-08` — support trace.
- `CORE-CAR-09` — public result projection.
- `CORE-CAR-10` — customer-facing claim safety policy.
- `CORE-CAR-11` — pack operational status and emergency stop.
- `CORE-CAR-13` — specific physical inventory item state.
- `CORE-CAR-14` — identity future-proofing without web3 dependency.

## Collector Crypt-specific CARs

### CC-CAR-01 — Structured collectible metadata

- **Challenge:** Free-text prize names cannot reliably power inventory, support, fulfillment, value display, or future marketplace.
- **Action:** Add structured collectible metadata: grading company, grade label, year, set, card number, parallel/edition, image, reference value, currency, value source.
- **Result:** Customer inventory, result pages, pack detail, and support views can present consistent card/slab details.
- **Priority:** P1.
- **Acceptance:** Missing metadata degrades gracefully; “insured” label is unavailable unless insured custody is approved; draw-time snapshot stores metadata shown to customer.

### CC-CAR-02 — Reference value source policy

- **Challenge:** Customers care about value, but “insured value” overclaims unless real insurance/custody exists.
- **Action:** Model value as reference value with source/type/timestamp; reserve insured value for approved insurance-backed custody.
- **Result:** Oripa can communicate approximate value without making unsupported insurance claims.
- **Priority:** P1.
- **Acceptance:** UI labels value source; admin chooses source/type; “insured” copy is blocked by claim validation unless enabled.

### CC-CAR-03 — Custody and fulfillment metadata

- **Challenge:** Physical prizes require status about whether Oripa/vendor/third party holds the item and whether it can be fulfilled.
- **Action:** Add custody status and fulfillment eligibility fields to prize/user-prize records: UNKNOWN, PLATFORM_CUSTODY, VENDOR_CUSTODY, THIRD_PARTY_CUSTODY, SHIPPED, EXTERNAL.
- **Result:** Customers and support know what actions are possible without overclaiming vault/insurance.
- **Priority:** P1 if physical fulfillment exists.
- **Acceptance:** Customer UI does not say vaulted or insured unless approved; internal location fields are hidden; custody changes write audit logs.

### CC-CAR-04 — Pack operational machine state

- **Challenge:** Gacha systems must safely reject opens when machine/pack is empty, paused, overloaded, or emergency-stopped.
- **Action:** Extend core pack operational status with machine-level controls and customer-safe unavailable reasons.
- **Result:** Customers cannot open unsafe packs and operators can stop the system quickly.
- **Priority:** P0 via `CORE-CAR-11`.
- **Acceptance:** Empty/paused/emergency-stopped packs reject draw attempts; status changes are audited; in-flight retry behavior is deterministic.

### CC-CAR-05 — Return-to-points / auto-return roadmap

- **Challenge:** Collector Crypt has buyback/turbo patterns, but Oripa MVP should not promise cash or automatic sellback unless implemented.
- **Action:** Implement manual customer-confirmed return-to-points first; treat auto-return/turbo as roadmap.
- **Result:** Oripa gains safe liquidity without confusing customers about cash payouts.
- **Priority:** Manual return P0/P1 if advertised; auto-return roadmap.
- **Acceptance:** Return amount preview; explicit confirmation; idempotent ledger credit; no double-credit; auto-return hidden until implemented.

### CC-CAR-06 — Purchased pack / open-later voucher roadmap

- **Challenge:** Gifts, promos, bundles, and open-later flows need pack ownership before opening, unlike immediate paid draw.
- **Action:** Define future PackVoucher/PurchasedPack model with statuses AVAILABLE, OPENED, EXPIRED, CANCELLED, source, owner, idempotency, and linked draw order.
- **Result:** Oripa can later support gifted/free/purchased packs without rewriting draw records.
- **Priority:** Roadmap unless explicitly needed.
- **Acceptance:** Expired/cancelled/opened vouchers cannot be opened; opening a voucher atomically creates one draw order and marks voucher opened.

### CC-CAR-07 — Free spin/promo anti-abuse gate

- **Challenge:** Free spins/free packs attract users but are easy to farm.
- **Action:** Treat real promo spins as gated by centralized eligibility, rate limits, duplicate-account controls, and ledger/source records; keep demo spins separate.
- **Result:** Growth mechanics can be added without breaking economics.
- **Priority:** Roadmap unless private/admin-only or demo-only.
- **Acceptance:** Eligibility is centralized; limits consider user/device/IP/payment identity/vendor where appropriate; real zero-price promo spin creates source ledger; demo creates no user prize.

### CC-CAR-08 — Future linked identity model

- **Challenge:** Wallet-linked ownership can be useful later, but MVP should not key prize ownership to mutable external wallet strings.
- **Action:** Keep User as canonical owner; define optional future LinkedIdentity with provider, providerSubject, verification status, linkedAt/unlinkedAt, audit trail.
- **Result:** Oripa can add wallet/Privy-style login later without orphaning prizes or wallet records.
- **Priority:** Design constraint; no web3 implementation.
- **Acceptance:** Draw/wallet/UserPrize/support/fulfillment records key to userId; unlinking identity does not orphan records.

### CC-CAR-09 — Marketplace-ready status vocabulary

- **Challenge:** Future listing/trading/transfer will be difficult if prize entitlement state cannot represent locks or marketplace states.
- **Action:** Reserve status vocabulary for LISTED, SOLD, TRANSFERRED, LOCKED while hiding unsupported actions in MVP.
- **Result:** The data model can evolve without promising marketplace at launch.
- **Priority:** Design now, implement later.
- **Acceptance:** MVP UI does not expose marketplace/trade/transfer; status transitions are documented and role-gated when implemented.

## Collector Crypt-specific customer stories

### STORY-CC-META-01 — View structured collectible details
As a customer, I want prize cards and prize details to show structured grade and reference metadata so that I can understand what I won.

Acceptance criteria:
- Prize detail supports grading company, grade label, year, set, card number, image, reference value, currency, and source.
- Missing metadata is hidden or labeled unknown safely.
- “Insured” is not displayed unless approved custody/insurance exists.
- Draw-time snapshot stores customer-visible metadata.

### STORY-CC-CUSTODY-01 — See fulfillment/custody-safe status
As a customer, I want to know whether my prize is eligible for fulfillment or return-to-points so that I understand available actions.

Acceptance criteria:
- Customer-safe status is derived from internal state.
- Internal storage/location fields are never exposed.
- Vault/insured language is not used unless approved.
- Fulfillment locks return-to-points; return disables fulfillment.

### STORY-CC-RETURN-01 — Confirm return-to-points
As a customer, I want to preview and confirm returning an eligible prize to points so that I do not accidentally forfeit a prize.

Acceptance criteria:
- Return amount and consequence are shown before confirmation.
- Operation is idempotent.
- Duplicate request cannot double-credit.
- Returned prize cannot be fulfilled or returned again.

### STORY-CC-VOUCHER-01 — Open a previously acquired pack later
As a future customer, I want to acquire a pack and open it later so that gifts, promos, and bundles are possible.

Acceptance criteria:
- Pack voucher has AVAILABLE, OPENED, EXPIRED, CANCELLED statuses.
- Opening an available voucher creates one draw order and marks voucher opened atomically.
- Expired/cancelled/opened vouchers cannot be opened.
- This is roadmap unless product explicitly prioritizes it.

### STORY-CC-FREE-01 — Receive promo spin safely
As a future customer, I want free/promotional spins to be clear and abuse-resistant so that rewards feel fair.

Acceptance criteria:
- Promo spin and demo spin are separate products.
- Real promo spin creates source/ledger record even at zero price.
- Demo creates no user prize.
- Eligibility and rate limits are centralized.

### STORY-CC-IDENTITY-01 — Link future external identity without losing prizes
As a future customer, I want to link or unlink an external wallet/social identity without losing prize records so that account ownership remains stable.

Acceptance criteria:
- User remains canonical owner.
- LinkedIdentity records provider, providerSubject, verification status, linkedAt/unlinkedAt, and audit trail.
- Unlinking does not orphan wallet, draw, prize, support, or fulfillment records.

### STORY-CC-MACHINE-STATUS-01 — See pack unavailable reason
As a customer, I want pack unavailable reasons shown safely so that I understand why I cannot open a pack.

Acceptance criteria:
- Empty/paused/emergency-stopped packs cannot be opened.
- UI shows customer-safe reason.
- API rejects attempts consistently.
- Status changes are audited.

### STORY-CC-MARKET-READY-01 — Hide future marketplace actions until implemented
As a customer, I should not see trade/sell/transfer actions until they work end to end so that I am not misled.

Acceptance criteria:
- Marketplace/trade/transfer buttons are absent in MVP.
- Reserved backend statuses do not leak as unsupported actions.
- Roadmap docs identify required future models and controls.

## Recommended Oripa SaaS impact from Collector Crypt

### P0 / shared core strengthened

- User prize / prize entitlement created in atomic draw.
- Pack operational status and emergency stop.
- Support trace and audit.
- Return-to-points if advertised.

### P1 near-MVP

- Structured collectible metadata.
- Reference value/source policy.
- Custody/fulfillment-safe metadata.
- Fulfillment request queue.

### P2 / roadmap

- Pack vouchers/open-later flow.
- Promo/free spins with anti-abuse.
- Linked identities.
- Marketplace-ready states hidden from UI.

### Explicit non-goals for MVP

- Privy/web3 wallet login.
- Solana/NFT transfers.
- Moonpay/Coinflow payments.
- USDC buyback/cash payouts.
- Collateralized loans.
- Marketplace/trading/peer transfers.

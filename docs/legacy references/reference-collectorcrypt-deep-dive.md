# Collector Crypt Reverse-Engineering Reference for Oripa SaaS

Source URLs:
- https://collectorcrypt.com/
- https://gacha.collectorcrypt.com/

Purpose: extract product, data-model, UX, and operational patterns from Collector Crypt that can improve Oripa SaaS without copying implementation details or adopting crypto/wallet dependencies prematurely.

## Executive summary

Collector Crypt is a physical-collectibles custody and digital trading platform with a gacha app. Its strongest reference patterns for Oripa SaaS are:

- Positioning real-world collectibles as digitally managed assets.
- Vault custody with authenticated/scanned/insured physical items.
- Marketplace-first lifecycle: buy, sell, transfer, and potentially collateralize.
- Wallet login through Privy and crypto/web3 rails.
- Gacha categories across Pokemon, Sports, One Piece, and Pop.
- Pack products by category and price/point denomination: PKMN 25/50/250/1000, ONEPIECE 250, ANIME 75, SEALED 80, SPORTS 100, FIREGRASS 100.
- Large prize inventory display with insured value and grade metadata.
- API surface in frontend chunks suggesting gacha endpoints: `openPack`, `generatePack`, `generatePurchasedPack`, `freePack`, `freeSpins`, `purchasedPacks`, `usePurchasedPack`, `getRecentWinners`, `getAllWinners`, `getWeightedInsuredValue`, `getNfts`, buyback, Coinflow/Moonpay/Privy/Solana integrations.

For Oripa SaaS, the key takeaway is not to adopt web3 immediately. It is to model prize ownership as a durable asset with custody status, insured/reference value, transfer/marketplace readiness, and clear lifecycle states. This directly improves the existing user-prize-inventory, proof, support, and fulfillment stories.

## Observed public product structure

### Corporate/home page

Visible claims/patterns:

- “Like Fort Knox, but with a marketplace.”
- “Your Digital Bridge for Real-World Collectibles.”
- Vault physical collectibles securely.
- Trade them with others.
- Collateralize assets for loans.
- Secured vaults include PSA, PWCC, and ALT.
- Cards are authenticated, scanned, and linked to a profile or wallet.
- Buy, sell, and transfer cards securely at lower fees.
- Wallet integration: Privy.

Oripa SaaS implication:

- Durable prize ownership should be treated as a first-class asset model, not just draw result rows.
- Future marketplace/trading/shipping/custody can be designed from the beginning even if MVP only supports inventory + return-to-points + admin-assisted fulfillment.
- Avoid collateral/loan claims unless explicitly built and legally approved.

### Gacha app categories and packs

Observed gacha categories:

- All
- Pokemon
- Sports
- One Piece
- Pop

Observed pack cards/products:

- PKMN 50
- PKMN 250
- PKMN 1000
- ONEPIECE 250
- PKMN 25
- ANIME 75
- SEALED 80
- SPORTS 100
- FIREGRASS 100

Oripa SaaS implication:

- Category + denomination naming is an effective compact pack-grid pattern.
- For MVP, pack cards should show category, price/point denomination, hero image, and maybe top-value examples.
- Multiple pack denominations within category should be first-class.

### Prize inventory display

Observed prize cards on gacha page include:

- Image.
- Title/name with year/card number/player/card name, often truncated in extracted text.
- Insured value.
- Grade.

Examples:

- 2016 #232 Rayquaza PSA 10 Japanese — insured value 3,200.00 — grade PSA 10.
- 2019 #SM226 Charizard-Holo PSA 10 — insured value 3,000.00.
- 2021 #215 Full Art/Umbreon Vmax — insured value 3,000.00 — grade Beckett 9.5.
- 2024 #232 Mew ex PSA 10 Paldean — insured value 3,000.00.
- 2018 #207 Full Art/Lugia GX PSA 10 — insured value 1,510.00.

Oripa SaaS implication:

- Add `insuredValue` or generalize `referenceValue` with source/type.
- Grade metadata should be structured, not embedded in the name.
- Prize model should support scanned asset images and custody metadata.

### Frontend/API surface inferred from chunks

Detected gacha-related endpoints in frontend bundles:

- `/api/openPack`
- `/api/generatePack`
- `/api/generatePurchasedPack`
- `/api/freePack`
- `/api/freeSpins?wallet=`
- `/api/purchasedPacks?wallet=`
- `/api/usePurchasedPack`
- `/api/getRecentWinners?packType=`
- `/api/getAllWinners?epic=`
- `/api/getWeightedInsuredValue?code=`
- `/api/getGachaWalletPubkeys`
- `/api/getNfts`
- `/api/createNftTransfer`
- `/api/buyback`
- `/api/coinflow/session`
- `/api/coinflow/tokenize`
- `/api/submitTransaction`
- `/api/status`
- telemetry and chat endpoints.

Also detected third-party/web3/payment surfaces:

- Privy wallet/auth.
- Coinflow.
- Moonpay.
- Solana mainnet/devnet/testnet references.
- NFT transfer and wallet pubkey endpoints.

Important caveat:

- These are frontend-bundle observations, not confirmed backend behavior or contractual API docs.
- Oripa SaaS should treat them as product-pattern signals, not copy their stack.

## Product lifecycle inferred from Collector Crypt

### Collectible custody lifecycle

Potential lifecycle:

1. Physical card enters custody/vault.
2. Card is authenticated/scanned/insured.
3. Digital profile/wallet asset is created or linked.
4. Asset can be traded/transferred/listed.
5. Asset can be used in gacha or won from gacha.
6. Asset can be bought back, redeemed, shipped, or potentially collateralized.

Oripa SaaS MVP mapping:

1. Vendor/admin creates prize with structured metadata.
2. Prize appears in pack detail/top-hit/value disclosure where appropriate.
3. Draw creates user prize inventory record atomically.
4. User can view inventory and draw history.
5. User can convert eligible prize to points or request admin-assisted fulfillment.
6. Support can inspect full trail.

Roadmap mapping:

- Self-serve shipping.
- Internal marketplace/listing.
- Peer transfer/trading.
- Vault custody/scanning workflow.
- External wallet/tokenization.
- Collateral/loan integrations only after legal/product approval.

### Wallet/auth model

Observed:

- Wallet · Privy on public site.
- Gacha app likely uses wallet address as identity for free spins/purchased packs.

Oripa SaaS implication:

- Current JWT auth is appropriate for MVP.
- Do not introduce Privy/web3 dependency without approval.
- But model abstraction should avoid assuming email-only identity forever:
  - `User` may later link wallet identities.
  - purchased packs/draw history should be keyed to user IDs, not mutable wallet strings.

### Purchased pack / use pack separation

Inferred endpoints:

- `generatePurchasedPack` and `purchasedPacks?wallet=` suggest a distinction between buying/receiving a pack voucher and opening/using it later.
- `usePurchasedPack` suggests pack ownership before opening.

Oripa SaaS implication:

- This is a useful roadmap pattern: purchased pack voucher/inventory separate from immediate draw.
- MVP can do immediate paid draw only.
- Roadmap can add `PurchasedPack` or `PackVoucher`:
  - purchase now/open later.
  - gift packs.
  - promo/free packs.
  - pack bundles.
  - delayed reveal.

### Free spins/free pack

Inferred endpoints:

- `freePack`.
- `freeSpins?wallet=`.

Oripa SaaS implication:

- Free pack/spin is a powerful acquisition mechanic, but should be gated by anti-abuse before public use.
- Use only after centralized eligibility, rate limiting, duplicate-account controls, and ledger semantics exist.

### Recent/all winners

Inferred endpoints:

- `getRecentWinners?packType=`.
- `getAllWinners?epic=`.

Oripa SaaS implication:

- Public winners/recent-pulls feed should be vendor-scoped, privacy-safe, and draw-record-backed.
- “Epic”/high-value winner filters can support social proof and conversion.

### Buyback endpoint

Detected:

- `/api/buyback`.

Oripa SaaS implication:

- Strengthens the importance of return-to-points/buyback lifecycle.
- MVP should implement return-to-points for eligible owned prizes before marketplace/trading.

## Data model candidates for Oripa SaaS

### User prize / asset inventory

Enhance or add user-owned prize model with:

- vendorId.
- userId.
- drawOrderId / drawResultId.
- prizeId.
- current status: OWNED, RETURNED_TO_POINTS, FULFILLMENT_REQUESTED, FULFILLED, LISTED, SOLD, TRANSFERRED, LOCKED, CANCELLED.
- custody status: UNKNOWN, PLATFORM_CUSTODY, VENDOR_CUSTODY, SHIPPED, EXTERNAL.
- reference/insured value and currency.
- grade company and grade label.
- image/scanned asset URL.
- return-to-points amount.
- fulfillment eligibility.
- immutable audit timestamps.

### Pack voucher / purchased pack roadmap

Potential `PurchasedPack` / `PackVoucher`:

- vendorId.
- userId.
- packId.
- source: PURCHASED, PROMO, FREE_SPIN, ADMIN_GRANT.
- status: AVAILABLE, OPENED, EXPIRED, CANCELLED.
- idempotency key / source event.
- purchasedAt/openedAt/expiresAt.
- open draw order ID.

### Asset custody / marketplace roadmap

Potential future models:

- `VaultAsset` linked to prize/userPrize.
- `AssetListing` for marketplace sale.
- `AssetTransfer` for peer/admin transfer.
- `FulfillmentRequest` for shipping/redemption.
- `AssetValuation` for insured/reference value source history.

## CAR themes from Collector Crypt

- Physical collectibles become digitally manageable assets.
- Vault/authentication/scanning/insured-value metadata increases trust.
- Gacha output feeds into inventory, not just a transient result screen.
- Wallet-linked profiles enable asset ownership and transferability.
- Purchased pack/free spin separation supports acquisition and deferred opening.
- Recent/all winners feed supports social proof.
- Buyback/return path gives liquidity after draw.
- Marketplace/trade/transfer is a powerful roadmap expansion.

## Customer story themes from Collector Crypt

- As a collector, I want my won card represented as a durable owned asset.
- As a collector, I want insured/reference value and grade metadata for owned prizes.
- As a collector, I want to see my draw history and inventory separately.
- As a collector, I want to convert, ship, sell, or transfer assets depending on platform maturity.
- As a new user, I want free spins/free packs only if they are abuse-safe and clearly separated from paid draws.
- As a vendor/operator, I want pack denominations and category grids that make product selection fast.
- As support, I want to trace an asset from pack configuration to draw to inventory to return/fulfillment.
- As finance/ops, I want buyback/return and valuation changes tracked immutably.

## Integration cautions for Oripa SaaS

- Do not add web3/Privy/Solana/Coinflow/Moonpay dependencies without explicit approval.
- Avoid collateral/loan language entirely unless legally approved and implemented.
- “Insured value” should be called “reference value” unless there is actual insurance/custody coverage.
- Free spins/free packs can be abused; treat as roadmap until anti-abuse controls exist.
- Marketplace/trade/transfer should be roadmap, not MVP.
- If pack vouchers are introduced, idempotency and expiration/ownership semantics must be explicit.
- Public winner feeds must not reveal private user inventory without consent.

# Oripa SaaS Reference Reverse Engineering — Phygitals + Collector Crypt

Purpose: convert public reference-site research on `phygitals.com` and `collectorcrypt.com` / `gacha.collectorcrypt.com` into actionable Oripa SaaS product, data-model, CAR, and customer-story guidance.

Scope: public unauthenticated surfaces only. No authenticated actions, no purchases, no mutation calls.

Generated: 2026-05-28.

## Source base

Public pages and APIs inspected:

- Phygitals homepage / how-it-works: `https://www.phygitals.com/how-it-works`
- Phygitals packs index: `https://www.phygitals.com/claw`
- Phygitals pack detail sample: `https://www.phygitals.com/claw/rookie-pack`
- Phygitals public API: `https://api.phygitals.com/api/vm/available?includeRepacks=true`
- Phygitals marketplace/public utility endpoints found in JS or crawl:
  - `https://api.phygitals.com/api/marketplace/prize-data`
  - `https://api.phygitals.com/api/marketplace/filters`
  - `https://api.phygitals.com/api/users/referrals-leaderboard`
- Collector Crypt marketing home: `https://collectorcrypt.com/`
- Collector Crypt gacha app: `https://gacha.collectorcrypt.com/`
- Collector Crypt public app API:
  - `https://gacha.collectorcrypt.com/api/status`
  - `https://gacha.collectorcrypt.com/api/getRecentWinners?packType=<code>`
  - `https://gacha.collectorcrypt.com/api/stats?data=linkedSendNftAndSpinTxns`
  - `https://gacha.collectorcrypt.com/api/getGachaWalletPubkeys`

Local artifacts saved during reverse engineering:

- `/tmp/oripa_refs/page_api_summary.json`
- `/tmp/oripa_refs/phygitals_available.json`
- `/tmp/oripa_refs/collectorcrypt_status.json`
- `/tmp/oripa_refs/collectorcrypt_stats.json`
- `/tmp/oripa_refs/collectorcrypt_gacha_api_tests.json`

Related Oripa SaaS docs:

- `docs/oripa-saas-car-proposal-reviewed.md`
- `docs/oripa-saas-customer-car-deep-research.md`
- `docs/oripa-saas-customer-stories-deep-proposal.md`
- `docs/reference-clove-pokemon-deep-dive.md`

Related local repo files:

- `prisma/schema.prisma`
- `apps/api/src/modules/draws/router.ts`
- `apps/api/src/modules/wallet/router.ts`

## Executive synthesis

Phygitals and Collector Crypt are not just “pack opening” references. Both frame the product as a **digital ownership + physical collectibles loop**:

`choose pack → pay/open → reveal random real vaulted card → own digital representation immediately → sell back / trade / marketplace / ship physical asset → verify or inspect enough public history to feel real`

For Oripa SaaS, the strongest customer promise should therefore shift from generic “mystery packs” toward:

> Launch TCG mystery-pack storefronts where buyers can inspect prize value bands before drawing, receive a durable owned prize after drawing, verify draw integrity, and choose what happens next: keep, convert/sell back, or request fulfillment.

The biggest gap in current Oripa SaaS is not draw mechanics. The draw route already has JWT auth, idempotency, serializable transaction, wallet debit, draw order/result, and HMAC proof records. The biggest gap is **post-draw ownership and customer-facing trust UX**:

- wallet route is still vendor-only and leaks first wallet under the vendor unless fixed;
- proof API exists, but customer proof page/history UX must exist before marketing fairness;
- there is no durable user prize inventory model equivalent to “owned card”;
- no customer “sellback / convert / ship / marketplace” lifecycle should be claimed until modeled;
- current `PackPrize` is too thin for Phygitals/CollectorCrypt-grade metadata: no category/tag tables, grade/certifier fields, insured/appraised value, buyback value, live odds bands, vault status, marketplace status, or fulfillment status.

## Phygitals reverse engineering

### Public positioning

Phygitals positions itself as “Real Cards, Owned Digitally.” Its how-it-works page claims:

- “Trusted by 100,000+ collectors.”
- “Open packs of real graded cards, own them instantly, and ship to your door or sell on the marketplace.”
- “1.9M Transactions,” “$167.9M Volume traded,” “24K Active listings.”
- Three-step loop:
  1. open a pack;
  2. reveal a real vaulted card;
  3. keep, ship, or sell.
- It explicitly says packs have “live odds” and “provably fair pulls powered by public VRF.”
- It emphasizes vaulting with PSA, Fanatics, and Alt, insurance, climate control, and worldwide tracked delivery.
- It markets “85–90% instant cash back” / buyback if the user does not like the pull.

### Pack index patterns

The `/claw` page is category-first and price-laddered:

- Categories shown: Pokemon, One Piece, Basketball, Baseball, Football, Soccer, Yu-Gi-Oh.
- Sort tabs include “Most Popular” and “Creator Packs.”
- Packs are grouped by category with count labels.
- Pack cards show:
  - category icon;
  - pack name;
  - buyback badge such as “+90% BUYBACK BOOST” or “85% buyback”;
  - price, e.g. `$25`, `$50`, `$250`, `$500`, `$1,000`, `$2,500`, `$5,000`.

### Pack detail patterns

The Rookie Pack page exposes the high-conversion detail pattern:

- pack family navigation across price tiers: Trainer $10, Rookie $25, Elite $50, Sealed $100, Legend $250, Base Set $500, Platinum $500, Mythic $1,000, Black $2,500, Diamond $5,000;
- “spice level” variants: Mild, Medium, Hot;
- expected value displayed as dollar amount per pack;
- live odds displayed as value bands, e.g. `$13-$18 50%`, `$18-$25 30%`, `$25-$50 15%`, `$50-$150 4%`, `$150-$10,000 1%`;
- “Top Hits” grid with exact card names, images, certifier/grade in title, and estimated value.

### Public API surface

The `available?includeRepacks=true` API returned 125 public pack rows at crawl time.

Observed fields include:

- identity: `id`, `slug`, `name`, `platform`, `type`, `variant_of`, `variants`, `creator_profile`;
- merchandising: `category`, `categories`, `description`, `claw_image_url`, `enable`, `in_stock`, `num_pulls_7d`, `last_pull`, `max_per_mint`, `repack`;
- pricing/value: `mint_price`, `ev`, `ev_updated_at`, `min_ev`, `max_ev`, `buyback_percent`;
- odds: `rarity_distribution` with band rows `{ id, name, color, lower, upper, weight }`;
- rewards: `rewards_amounts`, `sellback_rewards_amounts`, `rewards_decimals`, `rewards_mint_addresses`, `rewards_symbols`;
- chase/top-hit context: `chase`.

Observed distribution:

- 125 packs returned.
- Category counts: Pokemon 55, One Piece 22, Baseball 5, Basketball 5, Football 3, Yu-Gi-Oh 1, plus 34 with null primary category.
- Prices ranged from `$10` to `$10,000`.
- Buyback percent distribution: 85% on 75 packs, 90% on 38 packs, 92% on 11 packs, 100% on 1 pack.

### Product lessons for Oripa SaaS

1. **Expected value is a product surface, not only an internal calculation.** Phygitals makes EV visible on detail pages and supports it in API fields (`ev`, `min_ev`, `max_ev`, `ev_updated_at`).
2. **Odds are easier to digest as value bands.** Users do not need to inspect every row to understand risk; bands like `$13-$18 50%` communicate expected downside/upside quickly.
3. **Buyback reduces regret.** The 85–92% buyback message is central to conversion because it makes bad pulls feel liquid.
4. **Pack variants create replayability.** “Spice level” variants change risk/reward without creating an entirely separate mental model.
5. **Physical legitimacy sells the draw.** Vault partners, insurance, tracked shipping, and card images make the mystery feel attached to real assets.
6. **Leaderboard/referral/game loops are retention layers.** Public endpoints expose weekly prize data and referral leaderboard, but these should be roadmap for Oripa, not MVP.

## Collector Crypt reverse engineering

### Public positioning

Collector Crypt’s main site positions the product as a vault and marketplace for real-world collectibles:

- “Like Fort Knox, but with a marketplace.”
- “Vault your physical collectibles securely, trade them with others, and even collateralize your assets for loans.”
- Cards are sent to secured vaults “including PSA, PWCC and ALT,” stored and insured.
- Cards are authenticated, scanned, and linked to a user profile or wallet.
- Users can buy, sell, and transfer cards securely.

The gacha app adds a pack-opening layer on top of this tokenized/vaulted asset model.

### Gacha app surface

The gacha home page shows category filters and pack cards:

- filters: All, Pokemon, Sports, One Piece, Pop;
- pack cards observed: PKMN 50, PKMN 250, PKMN 1000, ONEPIECE 250, PKMN 25, ANIME 75, SEALED 80, SPORTS 100, FIREGRASS 100;
- high-value prize display with image, exact card title, insured value, and grade.

Example public prize cards shown on the page include:

- 2016 Rayquaza PSA 10, insured value `$3,200`;
- 2019 Charizard-Holo PSA 10, insured value `$3,000`;
- Umbreon VMAX Beckett 9.5, insured value `$3,000`;
- Mew ex PSA 10, insured value `$3,000`.

### Public API surface

`/api/status` returned the active machine state and 32 gacha definitions.

Top-level state fields:

- `machineStatus`, `legendaryStatus`, `eliteStatus`, `freePacksStatus`, `sportsStatus`;
- `gachas`: list of pack definitions.

Observed gacha row fields:

- `code`, e.g. `pokemon_50`, `pokemon_250`, `pokemon_1000`, `onepiece_250`, `pokemon_25`;
- `name`, e.g. “Elite Pokémon Gacha Pack”;
- `price`, e.g. 25, 50, 80, 100, 250, 1000, 2500, 5000;
- `status`, usually `open` or `closed`;
- `isOpen`, boolean/null.

Observed distribution:

- 32 gacha definitions;
- 11 open and 21 closed at crawl time;
- prices: 25, 50, 75, 80, 100, 250, 1000, 2500, 5000;
- categories/packs include Pokemon, One Piece, comics, anime, sealed, sports, football, basketball, baseball, character/theme packs.

`/api/getRecentWinners?packType=<code>` returns recent winners. Observed fields include:

- `winner` wallet address;
- `prizewallet` bucket;
- NFT metadata including URI, mint address, supply/currency fields, and authority fields.

`/api/stats?data=linkedSendNftAndSpinTxns` returns recent operational event rows. Observed fields include:

- `spin_txn_created_at`;
- `send_nft_created_at`;
- `spin_wallet`;
- `memo`;
- `spin_txn_signature`;
- `send_nft_signature`;
- `nft_address`;
- `roll`.

`/api/getGachaWalletPubkeys` returns public Solana wallet addresses for gacha prize wallets.

Mutation-like endpoints exist but were not used beyond harmless empty-body validation tests:

- `POST /api/freePack` → validation error for invalid pack type.
- `POST /api/buyback` → validation error for invalid altRecipient address.
- `POST /api/openPack` → validation error for invalid memo parameter.
- `POST /api/generatePack` → invalid request body.
- `POST /api/generatePurchasedPack` / `usePurchasedPack` → missing publicKey.

### Product lessons for Oripa SaaS

1. **Open/closed state is first-class.** Collector Crypt exposes `status` and `isOpen` per gacha. Oripa should expose list/detail/draw availability with stable reason codes.
2. **Pack codes are human-readable product SKUs.** `pokemon_50` communicates category + price tier better than opaque IDs.
3. **Recent winners are a trust and excitement feed.** Public recent-winner rows make the machine feel live, but Oripa should avoid leaking unnecessary wallet/user PII; use masked user handles and prize summaries if implemented.
4. **On-chain/ledger traces sell auditability.** Spin transaction, send NFT transaction, memo, roll, and NFT address create a public chain of custody. Oripa can emulate this without blockchain by linking draw order, proof, wallet ledger, prize inventory, and audit events.
5. **Tokenized ownership is the actual product.** A draw outcome is not complete until the user owns a discrete asset that can be held, sold/converted, transferred, or shipped.

## Cross-reference matrix: reference features vs current Oripa SaaS

### Already partly present in Oripa SaaS

- JWT-authenticated draw endpoint in `apps/api/src/modules/draws/router.ts`.
- Idempotency key requirement for draw requests.
- Serializable transaction around draw, wallet debit, stock decrement, draw result, proof, audit, outbox.
- Draw fairness proof table and proof API.
- Vendor model and vendor-scoped packs/wallets/orders in `prisma/schema.prisma`.
- WalletAccount and WalletEntry ledger models.
- VendorRevenueLedger, AuditLog, OutboxEvent foundation.

### Present but not customer-complete

- Fairness proof API exists, but public/customer web proof page and history UX are still required.
- Draw result exists, but user prize inventory / ownership lifecycle is missing.
- Wallet ledger model exists, but `/v1/wallet` route currently queries first wallet by vendor only; must be JWT user-scoped before customer use.
- Pack and PackPrize exist, but metadata is far too thin for card-grade storefront claims.

### Missing or too thin for Phygitals/CollectorCrypt-grade product

- Category and tag tables / pack classification beyond basic Pack fields.
- Pack slug/SKU/code separate from internal ID.
- Pack variant groups (spice levels, price tiers, related packs).
- EV fields: expected value, min EV, max EV, updated time.
- Live odds bands and display color metadata.
- Buyback/return policy fields and per-prize sellback values.
- Prize inventory model for user-owned post-draw assets.
- Prize lifecycle statuses: owned, listed, converted/sold back, fulfillment requested, shipped, cancelled/adjusted.
- Vault/fulfillment metadata: certifier, grade, serial/cert number, insured/appraised value, vault provider, condition, shipping eligibility.
- Recent winners/feed with privacy-safe masking.
- Pack open/closed status and reason codes exposed consistently.
- Admin publish validation for EV/odds/buyback/prize metadata completeness.
- Marketplace/listing/trade loop.

## CAR proposals inspired by Phygitals

### PHY-CAR-01 — Real-card digital ownership

- **Challenge:** Buyers hesitate to spend on mystery packs when the result feels like a temporary animation rather than ownership of a real collectible.
- **Action:** Convert every successful draw into a durable user-owned prize record linked to card metadata, draw order, wallet ledger, fairness proof, and fulfillment/convert status.
- **Result:** Customers can leave the result page and still manage what they own, creating the foundation for keep, convert, ship, or marketplace flows.

### PHY-CAR-02 — Live odds by value band

- **Challenge:** Prize tables can overwhelm customers and make risk hard to understand.
- **Action:** Add pack-level odds bands with lower/upper value ranges, probability/weight, display color, and last-calculated timestamp; render them on pack detail before draw.
- **Result:** Customers understand downside, mid-tier likelihood, and chase upside quickly, improving confidence before spending.

### PHY-CAR-03 — Expected value transparency

- **Challenge:** Premium packs need a defensible reason for high prices, especially when outcomes are random.
- **Action:** Store and display expected value, min/max value estimates, and last-updated timestamp from the active prize pool.
- **Result:** Vendors can sell high-value packs with clearer economics and customers can judge risk/reward without support explanations.

### PHY-CAR-04 — Buyback / convert-to-points reduces regret

- **Challenge:** Low-value or duplicate pulls create buyer remorse and fulfillment cost.
- **Action:** Allow eligible owned prizes to be converted back to points using visible buyback percentages or fixed return amounts, recorded as immutable wallet ledger credits.
- **Result:** Customers get a second-chance loop and vendors reduce unnecessary shipping/support load.

### PHY-CAR-05 — Price-tier and variant navigation

- **Challenge:** Customers with different budgets need a fast way to move between low-risk, mid-tier, and high-chase packs.
- **Action:** Group related packs into families and variants with display labels like Starter, Rookie, Elite, Legend, Mythic, or Mild/Medium/Hot.
- **Result:** Customers can ladder up or down without re-learning the category, increasing browsing depth and repeat draws.

### PHY-CAR-06 — Vault and fulfillment credibility

- **Challenge:** High-value physical prizes require proof that the card exists, is protected, and can be delivered.
- **Action:** Add optional vault/certifier/insured-value/fulfillment metadata and only display shipping/vault claims when configured and operationally supported.
- **Result:** Premium buyers get confidence that expensive cards are real and fulfillable, while Oripa avoids overclaiming before fulfillment exists.

### PHY-CAR-07 — Game-loop retention after MVP

- **Challenge:** Pack opening can become one-and-done without reasons to return.
- **Action:** Add roadmap game loops such as weekly leaderboard prizes, referral leaderboard, pack vouchers, and points rewards only after wallet/prize/proof foundations are stable.
- **Result:** Vendors can run engagement campaigns without contaminating MVP with abuse-prone mechanics.

## CAR proposals inspired by Collector Crypt

### CC-CAR-01 — Open/closed machine status

- **Challenge:** Customers lose trust when a pack appears available but fails at draw time.
- **Action:** Give every pack/gacha a public availability state and stable reason codes: open, closed, sold out, before release, ended, auth required, insufficient balance, limit reached.
- **Result:** Customers know whether they can draw before trying, reducing failed checkout/draw moments.

### CC-CAR-02 — Human-readable pack SKUs

- **Challenge:** Internal IDs are poor customer and support references.
- **Action:** Add pack codes/slugs that encode category and price tier, such as `pokemon_50`, while retaining internal IDs for database relations.
- **Result:** Customers, support, and vendor operators can discuss packs using memorable identifiers.

### CC-CAR-03 — Recent winners as social proof

- **Challenge:** New users wonder whether valuable prizes are actually being won.
- **Action:** Publish a privacy-safe recent-winners feed showing masked user handle/wallet, pack code, prize summary, timestamp, and proof/result link where safe.
- **Result:** The storefront feels live and credible without exposing raw sensitive user data.

### CC-CAR-04 — Transaction/proof chain of custody

- **Challenge:** Random draw disputes are hard to resolve if payment, RNG, prize assignment, and fulfillment are separate records.
- **Action:** Link wallet ledger entry, draw order, draw result, fairness proof, prize inventory item, audit log, and support lookup under one traceable request/draw ID.
- **Result:** Customers and support can reconstruct what happened from purchase to ownership without engineering database access.

### CC-CAR-05 — Tokenized/vaulted asset semantics without blockchain dependency

- **Challenge:** Customers value the immediate ownership semantics of tokenized collectibles even if Oripa does not use blockchain.
- **Action:** Model a won prize as a unique owned asset with metadata, status, source draw, and allowed actions rather than a one-time result row.
- **Result:** Oripa can deliver the UX benefits of tokenized collectibles—hold, convert, ship, later list—while staying database-native.

### CC-CAR-06 — Free/demo pack guardrails

- **Challenge:** Free pack and demo mechanics can attract users but are abuse-prone and legally/commercially sensitive.
- **Action:** Defer free/demo packs until auth, eligibility, anti-abuse, ledger semantics, and support lookup are stable; label demos clearly as non-real if inventory is not consumed.
- **Result:** Vendors can experiment with acquisition loops without undermining trust or exposing inventory/funds.

## Customer-story proposals

### STORY-PHY-01 — View value bands before drawing

- **As a** collector,
- **I want** to see value-band odds and expected value before opening a pack,
- **so that** I understand the risk/reward profile before spending points.

Acceptance criteria:

- Pack detail shows value bands with lower/upper range and probability/weight.
- EV/min/max values render with last-updated timestamp if present.
- Missing EV does not block pack display but suppresses EV claims.
- Admin publish validation warns when visible odds/EV are stale or inconsistent with prize pool.

### STORY-PHY-02 — Convert a won prize back to points

- **As a** player,
- **I want** to convert eligible wins back into points,
- **so that** I can keep playing instead of shipping cards I do not want.

Acceptance criteria:

- Won prize inventory row displays return amount or buyback percentage before action.
- Conversion writes immutable wallet credit and updates inventory status.
- Converted prizes cannot be converted or shipped again.
- Support lookup shows source draw, conversion event, and ledger credit.

### STORY-PHY-03 — Navigate related pack variants

- **As a** returning collector,
- **I want** to move between related pack tiers and variants,
- **so that** I can choose the budget and risk level I want today.

Acceptance criteria:

- Pack detail page shows related packs in the same family.
- Variants have display order, label, price, availability, and optional risk label.
- Active variant is URL-addressable.
- Draw API only accepts the selected actual pack ID/code.

### STORY-PHY-04 — See vault/fulfillment credibility for premium wins

- **As a** high-value buyer,
- **I want** premium prize pages to show grade, certifier, insured/appraised value, and fulfillment status where available,
- **so that** I know the physical asset is real and operationally supported.

Acceptance criteria:

- Prize metadata supports certifier, grade, cert number, insured/appraised value, vault provider, and fulfillment eligibility.
- UI only displays fields that are populated and verified.
- Shipping claims are disabled unless fulfillment workflow exists.

### STORY-CC-01 — Know whether a pack is open before attempting draw

- **As a** player,
- **I want** every pack to show open/closed/sold-out/eligibility status,
- **so that** I do not try to draw unavailable packs.

Acceptance criteria:

- List and detail show the same availability reason returned by API.
- Draw API enforces the same state.
- CTA copy changes for closed/sold-out/auth/insufficient-balance/limit states.

### STORY-CC-02 — Revisit a recent winner/proof feed

- **As a** prospective player,
- **I want** to see recent wins in a privacy-safe feed,
- **so that** I can trust the machine is active and prizes are real.

Acceptance criteria:

- Feed shows masked user, pack, prize summary, timestamp, and optional proof/result link.
- Feed never exposes raw email, full name, or unmasked sensitive account identifiers.
- Feed can be disabled per vendor.
- Support/admin can trace feed items to internal draw IDs.

### STORY-CC-03 — Use a memorable pack code in support conversations

- **As a** customer or support agent,
- **I want** pack codes like `pokemon_50` or `onepiece_250`,
- **so that** we can refer to packs without copying long internal IDs.

Acceptance criteria:

- Pack model has unique vendor-scoped code/slug.
- Public URLs and support lookup accept code/slug where safe.
- Internal relations still use stable IDs.
- Codes are validated for uniqueness and display safety before publish.

### STORY-CC-04 — Trace a draw from payment to prize ownership

- **As a** support agent,
- **I want** one lookup to show wallet debit, draw result, proof, prize inventory item, and post-draw action,
- **so that** I can resolve disputes without engineering help.

Acceptance criteria:

- Lookup by draw order ID, request ID, proof ID, or prize inventory ID.
- View is role-restricted and vendor-scoped.
- Shows wallet ledger, draw result, proof, inventory status, conversion/fulfillment status, and audit events.
- Lookup action is audited.

## Recommended Oripa SaaS roadmap changes

### P0 — before public/customer claims

1. Fix `/v1/wallet` to require JWT and query by `vendorId + authenticated userId`.
2. Add web proof page/history for existing proof API.
3. Add durable user prize inventory model.
4. Add pack availability/reason-code service shared by list/detail/draw.
5. Add pack code/slug and category/tag model.

### P1 — core differentiation from reference sites

1. Add value-band odds and EV fields.
2. Add buyback/convert-to-points for eligible inventory items.
3. Add prize card metadata: grade, certifier, card number, condition, insured/appraised value, image, source, fulfillment eligibility.
4. Add pack family/variant group navigation.
5. Add admin publish validation for odds, EV, prize metadata, buyback fields, and pack status.

### P2 — retention / social proof

1. Privacy-safe recent winners feed.
2. Weekly leaderboard / pack voucher campaigns.
3. Referral campaigns.
4. Marketplace/listing flow.
5. Self-serve shipping with address, fees, selected prizes, and tracking.

## Copy-safe messaging for Oripa SaaS

Safe after P0/P1 implementation:

> Oripa SaaS lets operators launch TCG mystery-pack storefronts where customers can browse by category and pack tier, review prize lineups and value-band odds before drawing, draw with wallet-backed idempotency protection, verify each paid result, and manage won prizes from a durable account inventory.

Safe only if buyback/convert is implemented:

> Customers can convert eligible wins back into points, reducing regret and keeping the collecting loop active.

Safe only if fulfillment workflow is implemented:

> Customers can request shipment for eligible physical prizes with tracked fulfillment status.

Unsafe until implemented and verified:

- “Ships worldwide.”
- “Fully insured vault storage.”
- “Marketplace trading.”
- “Public VRF” if Oripa remains HMAC commitment/reveal rather than public VRF.
- “85–90% buyback” unless exact economics exist.
- “Recent winners” if feed privacy and traceability are not implemented.
- “Free packs” or “daily packs” before abuse controls.

## Handoff summary for `@HRMcodingbot`

Build toward the reference-site product loop, but do not clone every gamification layer first. The highest-ROI engineering sequence is:

1. wallet auth/user scope fix;
2. proof page/history UX;
3. prize inventory model and creation inside draw transaction;
4. convert-to-points/buyback for eligible inventory;
5. pack code/category/tag/variant/availability model;
6. value-band odds + EV calculation/display;
7. richer prize metadata;
8. support trace lookup;
9. recent winners feed and retention loops after core trust is solid.

This gives Oripa the same trust architecture that makes Phygitals and Collector Crypt persuasive—real assets, visible value, post-draw ownership, and traceability—without prematurely claiming vault, blockchain, marketplace, or shipping features that are not in the current codebase.

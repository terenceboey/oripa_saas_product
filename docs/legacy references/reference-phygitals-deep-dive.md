# Phygitals Reverse-Engineering Reference for Oripa SaaS

Source URLs:
- https://www.phygitals.com/
- https://www.phygitals.com/claw/rookie-pack
- https://www.phygitals.com/claw/starter-pack-q4pux3
- https://www.phygitals.com/claw/starter-football-pack
- https://www.phygitals.com/claw/starter-one-piece-pack
- https://www.phygitals.com/claw/yugioh-pro-pack

Purpose: extract product, data-model, UX, and operational patterns from Phygitals that can improve Oripa SaaS without copying implementation details or overclaiming unsupported features.

## Executive summary

Phygitals is closer to an Oripa/claw-machine product than a pure marketplace. The strongest reference patterns are:

- Category-led pack navigation across TCG and sports verticals.
- A pack ladder by price tier: starter/rookie/elite/legend/platinum/mythic/black/diamond.
- “Spice level” pack variants for different risk/reward profiles.
- Expected value display per pack and per variant.
- Live odds/value-band disclosure rather than only listing individual prizes.
- Top-hit showcase with appraised/graded card metadata and estimated values.
- Recent pulls feed for social proof and freshness.
- Instant buyback / sellback promise expressed as 85–90% or higher depending on pack tier.
- Post-draw choices: hold, trade, redeem physical card, or sell back.
- Demo spin/try-before-pay affordance on pack pages.
- Digital ownership bridge for physical slabs, likely with wallet/NFT-like identity, but Oripa SaaS should treat this as roadmap unless a tokenization strategy is explicitly approved.

For Oripa SaaS, the best near-term takeaway is not blockchain/NFT implementation. It is a tighter pack-detail contract: price ladder, EV/value-band disclosure, top hits, buyback/return-to-points rates, recent pulls, pack variants, and post-draw ownership actions.

## Observed public product structure

### Home page

Visible claims/patterns:

- Hero message: “Rip packs. Pull graded cards.”
- Choice after pull: hold, trade, redeem, or sell back at up to 90% value.
- “Open Packs” section.
- Category cards for Pokémon, Basketball, Football, One Piece, Baseball, Yu-Gi-Oh.
- “85–90% instant buyback” merchandising line.
- “Recent Pulls” feed with card image, timestamp, card name, pack name, and recent reveal state.

### Pack categories

Observed category icons/navigation:

- Pokémon
- One Piece
- Basketball
- Baseball
- Football
- Soccer
- Yu-Gi-Oh!
- Riftbound
- Dragon Ball

Oripa SaaS implication:

- Category model should support both TCG and sports/non-TCG categories.
- UI should not hardcode only Pokemon-like categories.
- Category records need slug, label, image/icon, display order, active state, and optional vendor scope.

### Pack ladder and price tiers

Observed examples:

- Pokémon: Trainer $10, Rookie $25, Elite $50, Sealed $100, Legend $250, Base Set $500, Platinum $500, Mythic $1,000, Black $2,500, Diamond $5,000.
- Basketball: Starter $50, Legend $250, Platinum $500, Black $1,000, Pro $2,500, Diamond $5,000.
- Football: Starter $25, Elite $50, Platinum $500.
- One Piece: Starter $25, Elite $50, East Blue $80, Sealed $100, Legend $250, Platinum $500, Mythic $1,000, Black $2,500.
- Yu-Gi-Oh: Pro $25 in observed page.

Oripa SaaS implication:

- Packs should support tier/series relationships within a category, not just independent records.
- UI needs a horizontal pack-tier selector on detail pages.
- “Pack family” and “pack variant” are distinct concepts:
  - family: Pokemon Rookie/Elite/Legend ladder or One Piece Starter/Elite ladder.
  - variant: spice/risk profile within the same price point.

### Spice/risk variants

Observed on Pokémon Rookie and One Piece Starter pages:

- “Select Spice Level?”
- Mild, Medium, Hot variants.
- Variants have different rarity/value-band weights.

Extracted from Next data for Pokémon Rookie:

- activeBox keys include `variants`, `rarity_distribution`, `ev`, `min_ev`, `max_ev`, `buyback_percent`, `in_stock`, `max_per_mint`, `num_pulls_7d`, `last_pull`.
- Example `rarity_distribution` objects include:
  - `name`: Common, Uncommon, Rare, Epic, Mythic.
  - `color`: display hex.
  - `lower` / `upper`: value band bounds.
  - `weight`: distribution percentage/weight.
- Example variant metadata:
  - `slug`: `rookie-pack-0` / `rookie-pack-1`.
  - `mint_price`: `25`.
  - `min_ev`: `24.75`.
  - `max_ev`: `26.75`.
  - `ev`: variant expected value, periodically updated.
  - `buyback_percent`: `0.85`.
  - `buyback_wallet`: internal wallet/address reference.

Oripa SaaS implication:

- Add `PackVariant` concept or encode variant fields on Pack with parent/family relationship.
- Variant should define:
  - display label: Mild/Medium/Hot or vendor-defined.
  - risk level/risk label.
  - price.
  - expected value display policy.
  - value-band distribution rows.
  - buyback/return-to-points percentage.
  - max draws per request/user if applicable.
  - active/in-stock state.
- Variant weights must be tied to the same provably fair draw/snapshot mechanism if used in Oripa SaaS.

### Expected value and live odds/value bands

Observed examples:

- Pokémon Rookie: Expected Value `$25 per pack`; bands like `$13-$18 50%`, `$18-$25 30%`, `$25-$50 15%`, `$50-$150 4%`, `$150-$10,000 1%`.
- Basketball Starter: Expected Value `$52 per pack`; bands `$30-$40 50%`, `$40-$60 30%`, `$60-$110 15%`, `$110-$250 4%`, `$250-$15,000 1%`.
- Football Starter: Expected Value `$26 per pack`; bands `$12-$25 70%`, `$25-$50 25%`, `$50-$100 4%`, `$100-$7,000 1%`.
- One Piece Starter: Expected Value `$27 per pack`; bands `$13-$25 80%`, `$25-$50 15%`, `$50-$150 4%`, `$150-$5,000 1%`.
- Yu-Gi-Oh Pro: Expected Value `$26 per pack`; bands `$13-$18 50%`, `$18-$25 30%`, `$25-$50 15%`, `$50-$150 4%`, `$150-$20,000 1%`.

Important interpretation:

- These are public value-band disclosures, not necessarily exact prize-by-prize odds.
- The copy says “Live Odds?” and shows value ranges with percentages.
- Oripa SaaS must avoid EV/odds claims until the pack pool snapshot and draw algorithm support those claims exactly.

Oripa SaaS implication:

- Add optional `valueBandDisclosure` model:
  - lower value.
  - upper value.
  - label/color.
  - displayed probability/weight.
  - sort order.
  - computed vs manually entered flag.
  - source snapshot/version.
- If exact live odds are not implemented, use safer copy: “Displayed value bands” or “configured value bands,” not “live odds.”
- Publish validation should verify value-band weights total 100% if they are represented as percentages.

### Top hits showcase

Observed:

- Pack pages show “Top Hits — The top items available in this pack.”
- Each top hit has image, item/card name, grading company/grade in title, and estimated value.
- Examples include PSA, BGS, CGC graded cards.
- Top hits often show high-value chase inventory, not full prize pool.

Oripa SaaS implication:

- Add `isFeatured` / `featuredRank` for prizes or a separate featured-prize projection.
- Detail API should return top hits separately from full/internal pool.
- Top-hit cards need:
  - image.
  - display name.
  - grading company.
  - grade.
  - set/year/card number.
  - serial/edition if available.
  - estimated/reference value.
  - inventory availability or “available in pool” claim rules.

### Recent pulls feed

Observed:

- Home page and pack pages show recent pulls.
- Cards include image, timestamp (“2m ago”), card name, pack origin, and reveal status.
- Next data for home includes `recentPulls` with metadata, `value`, `claw_id`, `claw_name`, and `repack` flag.

Oripa SaaS implication:

- Recent pulls can materially improve trust/social proof, but must be privacy-safe.
- Add public recent-pulls projection that redacts user identity by default.
- Fields:
  - anonymized display name or no user.
  - prize image/name.
  - pack name/category.
  - timestamp bucket.
  - estimated value if allowed.
  - proof/result link only if public proof policy allows.
- Vendor-scoped and optionally pack-scoped feeds.

### Buyback / sellback / return-to-points

Observed:

- Home: sell it back at up to 90% value.
- Pack cards: 85–90% instant buyback.
- Pack data includes `buyback_percent`; variants include buyback percent and wallet/address fields.
- Higher price tiers often show 90%, some luxury tier appears 92% in data.

Oripa SaaS implication:

- Existing return-to-points story should be upgraded into a pack/prize policy:
  - pack-level default return percentage.
  - prize-level fixed return amount override.
  - eligibility: returnable vs shipping-only vs virtual-only.
  - customer-facing buyback/return label.
  - idempotent conversion transaction.
- Avoid “cash buyback” language unless actually paying fiat/crypto. Oripa SaaS MVP should say “return eligible prizes to points.”

### Post-draw asset lifecycle

Observed home copy:

- Hold the card in vault.
- Flip/sell on marketplace.
- Trade with collectors.
- Redeem/ship physical slab worldwide.
- Sell back to platform.

Oripa SaaS implication:

- This is a strong roadmap direction but not MVP unless implemented.
- MVP should support:
  - owned prize inventory.
  - return eligible prizes to points.
  - admin-assisted fulfillment request.
- Roadmap can include:
  - internal marketplace/listing.
  - peer-to-peer trade.
  - vault custody metadata.
  - self-serve shipping.
  - full physical redemption lifecycle.

### Demo spin

Observed:

- Pack pages include “Try a free demo spin.”

Oripa SaaS implication:

- Demo draw is useful for onboarding, but must be isolated from paid draw ledger and clearly labeled.
- Demo should never create real prize ownership, wallet debit, inventory reservation, or proof records that look like real purchases.

## Data model candidates for Oripa SaaS

### Pack family and variant

Candidate entities/fields:

- `PackFamily`: vendorId, categoryId, slug, title, displayOrder, active.
- `Pack`: current repo pack can remain the purchasable SKU, but add `familyId`, `tierLabel`, `tierRank`, `variantLabel`, `riskLevel`, `heroImageUrl`, `iconUrl`.
- `PackValueBand`: packId, label, color, lowerValue, upperValue, weightBps/percentage, displayOrder, source.
- `PackBuybackPolicy`: packId, defaultReturnPercentBps, returnCurrencyType, enabled, customerCopy.

### Prize/card metadata

Fields to consider:

- gradingCompany: PSA/BGS/CGC/SGC/MBA/AUTH.
- gradeLabel.
- year.
- setName.
- cardNumber.
- parallel/variant.
- serialNumber / print run.
- estimatedValue.
- insuredValue.
- imageUrl.
- externalVaultImageSource.
- featuredRank.

### Recent pulls projection

Fields to consider:

- vendorId.
- packId.
- drawOrderId.
- prizeId/userPrizeId.
- displayName.
- prizeImageUrl.
- estimatedValue.
- pulledAt.
- publicVisibility.
- userPrivacyMode.

## CAR themes from Phygitals

- Transparent pack risk/reward through EV and value bands.
- Price-tiered pack ladder for collectors with different budgets.
- Risk/spice variants for the same category/price family.
- Recent pulls as social proof.
- Top hits as conversion and trust driver.
- Post-draw asset utility: hold, return-to-points, trade, sell, redeem.
- Instant return/buyback promise.
- Demo spin onboarding.
- Physical-digital ownership bridge.

## Customer story themes from Phygitals

- As a collector, I want to choose a category and price tier quickly.
- As a risk-seeking collector, I want to choose mild/medium/hot variants with explicit value-band odds.
- As a cautious collector, I want EV and buyback/return policy before spending.
- As a collector, I want top-hit details with grading/value metadata.
- As a new user, I want demo spin before funding.
- As a drawn-prize owner, I want to hold, return to points, request shipment, or eventually trade/sell.
- As a vendor/operator, I want pack tiers and variants that can be published safely.
- As support, I want recent-pull/public result data to match the underlying draw/proof/inventory record.

## Integration cautions for Oripa SaaS

- EV/value-band disclosure is legally/product-sensitive. Do not claim “live odds” unless generated from actual current pool and draw weights.
- Buyback percentage should be points-return unless fiat/crypto payout exists.
- Demo spin must be firewalled from real ledger/draw systems.
- Marketplace/trading/vault tokenization is roadmap, not MVP.
- Recent pulls must not leak user identity, precise behavior, or private inventory.
- Top hits must not imply an item is still available if inventory changes after display; use snapshot/cache rules.
- Any “sell back at X%” claim needs precise policy and immutable ledger treatment.

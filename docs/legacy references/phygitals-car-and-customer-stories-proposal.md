# Phygitals-Derived CAR and Customer Stories Proposal for Oripa SaaS

Source reference: `docs/reference-phygitals-deep-dive.md`

Status: draft proposal before Oracle audit.

## Executive thesis

Phygitals is the strongest reference for the pack-opening storefront layer. The site demonstrates how an Oripa-like product can make gacha feel understandable before purchase: category navigation, price-tier ladders, risk/spice variants, expected value/value-band disclosure, top-hit showcases, recent-pulls social proof, demo spin, and a post-draw asset choice set.

For Oripa SaaS, Phygitals should inform three product surfaces:

1. **Pack discovery and detail pages** — category grid, pack ladder, featured top hits, value-band disclosure, clear price and return policy.
2. **Draw confidence mechanics** — demo spin, recent pulls, snapshot-backed odds/value bands, atomic result/proof/inventory record.
3. **Post-draw utility** — owned inventory, return-to-points policy, fulfillment request, roadmap marketplace/trading.

Do not copy Phygitals' NFT/web3 posture. Treat physical-digital ownership, trading, and marketplace as roadmap. MVP should remain JWT/account, points wallet, provably fair paid draw, durable owned prize inventory, support/audit trace, and admin-assisted fulfillment.

## Evidence extracted from Phygitals

Observed public patterns:

- Hero: “Rip packs. Pull graded cards.”
- Category navigation: Pokémon, One Piece, Basketball, Baseball, Football, Soccer, Yu-Gi-Oh!, Riftbound, Dragon Ball.
- Pack ladder examples:
  - Pokémon: Trainer $10, Rookie $25, Elite $50, Sealed $100, Legend $250, Base Set/Platinum $500, Mythic $1,000, Black $2,500, Diamond $5,000.
  - One Piece: Starter $25, Elite $50, East Blue $80, Sealed $100, Legend $250, Platinum $500, Mythic $1,000, Black $2,500.
- Spice/risk variants: Mild, Medium, Hot.
- Pack data exposes variant/value-band fields: `ev`, `min_ev`, `max_ev`, `buyback_percent`, `rarity_distribution`, `in_stock`, `max_per_mint`, `num_pulls_7d`, `last_pull`.
- Public value-band copy: “Expected Value” and “Live Odds?” with value ranges and percentage bands.
- Top hits section: image, graded-card title, estimated value.
- Recent pulls section: image, timestamp, card name, pack source, value metadata.
- Buyback/return positioning: 85–90% instant buyback, sometimes higher for luxury tiers.
- Post-draw utility copy: hold, trade, redeem, sell back.
- Demo spin affordance: “Try a free demo spin.”

## Guardrails for Oripa SaaS adoption

- Use “return to points” for MVP, not “cash buyback,” unless fiat/crypto payouts are implemented.
- Use “value bands” or “configured odds” unless odds are generated from the exact live prize pool and snapshot.
- Demo spins must not create real ledger, inventory, or proof records.
- Recent pulls must be privacy-safe and vendor-scoped.
- Top-hit availability must not overpromise after inventory changes.
- Marketplace/trading/vault ownership are roadmap, not MVP.

## CAR proposal — Phygitals-derived

### CAR-PHY-01 — Category-led pack discovery

- **Challenge:** Collectors need to quickly find packs matching their collecting interest, but a flat pack list hides category context and makes non-Pokemon expansion messy.
- **Action:** Add vendor-scoped category records and storefront category navigation with icons, slugs, display order, and active state.
- **Result:** Customers can browse by Pokémon, One Piece, sports, and future verticals without product or UI rewrites.
- **MVP priority:** P0.
- **Acceptance:** Pack list can filter by category; empty categories are hidden or labeled; vendor scoping prevents cross-tenant leakage.

### CAR-PHY-02 — Price-tier pack ladder

- **Challenge:** Customers with different budgets need an intuitive progression from entry packs to high-end packs.
- **Action:** Model pack families/tier rank so category pages can show Starter/Rookie/Elite/Legend/Platinum-style ladders.
- **Result:** The storefront communicates progression and lets vendors merchandise multiple denominations cleanly.
- **MVP priority:** P1.
- **Acceptance:** API returns family/tier metadata; UI sorts packs by tier rank within category; pack detail links sibling tiers.

### CAR-PHY-03 — Risk/spice variants

- **Challenge:** Two customers may want the same category/price point but different risk profiles.
- **Action:** Introduce pack variants or variant fields for Mild/Medium/Hot risk profiles, each with its own value-band weights and publish validation.
- **Result:** Customers can choose conservative or high-variance experiences with explicit disclosure.
- **MVP priority:** P2 after baseline pack proof/inventory is stable.
- **Acceptance:** Variant selection changes displayed value bands and draw configuration; variant identity is snapshotted into draw proof/result.

### CAR-PHY-04 — Value-band disclosure

- **Challenge:** Customers distrust mystery packs when they cannot understand the shape of possible outcomes.
- **Action:** Add pack value-band disclosure rows with lower/upper value, label/color, displayed weight/percentage, and source snapshot.
- **Result:** Customers see risk/reward distribution before spending.
- **MVP priority:** P1.
- **Acceptance:** Weights total 100% when shown as percentages; display copy does not claim live odds unless computed from the active pool.

### CAR-PHY-05 — Expected value policy

- **Challenge:** EV can drive confidence but creates legal/product risk if stale or manually wrong.
- **Action:** Add an explicit expected-value display policy: hidden, manually configured, or computed from current pool; store last computed timestamp and snapshot ID.
- **Result:** Oripa can show EV only when defensible and hide it otherwise.
- **MVP priority:** P2.
- **Acceptance:** Admin cannot publish “computed EV” without a valid computation; customer UI shows timestamp/source when EV is displayed.

### CAR-PHY-06 — Top-hit showcase

- **Challenge:** Customers want to know the most exciting possible pulls without scanning a full prize pool.
- **Action:** Add featured prize fields (`isFeatured`, `featuredRank`) and structured card metadata (grade, year, set, card number, image, reference value).
- **Result:** Pack detail pages can show trustworthy top-hit cards that improve conversion.
- **MVP priority:** P1.
- **Acceptance:** Featured cards are vendor/pack scoped; out-of-stock featured cards are removed or labeled safely.

### CAR-PHY-07 — Recent pulls social proof

- **Challenge:** Customers need proof that packs are active and real outcomes are being drawn.
- **Action:** Add vendor-scoped recent-pulls projection backed by draw/result/inventory records and privacy rules.
- **Result:** Storefront shows fresh public outcomes without leaking private user data.
- **MVP priority:** P1/P2.
- **Acceptance:** Public feed redacts user identity by default; support can trace each public item to an internal draw result.

### CAR-PHY-08 — Return-to-points policy

- **Challenge:** Customers need a liquidity path after winning a prize they do not want shipped.
- **Action:** Implement pack/prize return-to-points policy with return percentage or fixed return amount, eligibility flags, and idempotent wallet ledger entry.
- **Result:** Customers can convert eligible owned prizes back into points safely.
- **MVP priority:** P0/P1.
- **Acceptance:** Return operation is user-scoped, idempotent, audited, and changes prize status from OWNED to RETURNED_TO_POINTS.

### CAR-PHY-09 — Demo spin onboarding

- **Challenge:** New customers hesitate to fund an account before understanding the opening UX.
- **Action:** Add isolated demo spin mode that uses non-real sample pools and clear “demo only” labeling.
- **Result:** Customers can experience the reveal flow without financial or inventory side effects.
- **MVP priority:** P2.
- **Acceptance:** Demo creates no wallet debit, no real prize ownership, no real draw proof, and no inventory reservation.

### CAR-PHY-10 — Post-draw action hub

- **Challenge:** A result screen is not enough; customers need to know what they can do with the won asset.
- **Action:** On result and inventory pages, show allowed actions: keep in inventory, return to points, request fulfillment; roadmap placeholders hidden until implemented.
- **Result:** Draw outcomes become durable owned assets with clear next steps.
- **MVP priority:** P0.
- **Acceptance:** Available actions derive from prize status/policy; unsupported marketplace/trade actions are not shown.

### CAR-PHY-11 — Publish-time safety validation

- **Challenge:** Misconfigured pack odds, EV, return rates, or featured inventory can create trust and liability failures.
- **Action:** Add admin publish validation for price, stock, value bands, featured prizes, proof config, return policy, and display copy.
- **Result:** Vendors cannot publish customer-facing claims that the backend cannot support.
- **MVP priority:** P0/P1.
- **Acceptance:** Publish fails with actionable errors if weights are invalid, stock is empty, return policy is missing for returnable copy, or proof snapshot cannot be generated.

### CAR-PHY-12 — Privacy-safe public result projection

- **Challenge:** Public social proof needs to be useful without exposing customer behavior or private inventory.
- **Action:** Store public visibility controls on result projections and redaction policy per vendor.
- **Result:** Recent-pulls widgets are safe for production.
- **MVP priority:** P1/P2.
- **Acceptance:** Customers are anonymized unless consent exists; hidden/private results never appear in public feeds.

## Customer stories — Phygitals-derived

### Epic PHY-E1 — Discover packs by category and budget

#### STORY-PHY-CAT-01 — Browse by category
As a customer, I want to browse packs by collecting category so that I can quickly find packs relevant to my interests.

Acceptance criteria:
- Category tabs/cards are vendor-scoped.
- Selecting a category filters packs without showing other vendors' packs.
- Each category has label, icon/image, slug, active state, and display order.
- Empty inactive categories do not clutter the storefront.

#### STORY-PHY-CAT-02 — Compare pack tiers in one category
As a customer, I want to compare low, mid, and high-tier packs in the same category so that I can choose a pack matching my budget.

Acceptance criteria:
- Pack cards show category, price, title, and tier/rank.
- Sibling tiers are sorted by price/tier rank.
- Pack detail page links to sibling tiers.
- Unavailable tiers are disabled or clearly marked.

### Epic PHY-E2 — Understand risk and upside before spending

#### STORY-PHY-DISCLOSURE-01 — View value bands before draw
As a customer, I want to see value bands and configured probabilities before drawing so that I understand the range of possible outcomes.

Acceptance criteria:
- Pack detail shows rows like `$13-$25 — 80%` when configured.
- Percentages sum to 100% or publish validation fails.
- Copy distinguishes configured value bands from exact live odds unless live computation exists.
- The draw result stores the displayed value-band snapshot used at purchase time.

#### STORY-PHY-DISCLOSURE-02 — View expected value only when defensible
As a cautious customer, I want EV shown only when it is current and explainable so that I am not misled by stale marketing copy.

Acceptance criteria:
- EV is hidden unless enabled by policy.
- EV display includes source type and last computed/updated time if shown.
- Admin cannot publish computed EV without a valid snapshot.
- Support can see the EV/value-band snapshot shown to the customer.

#### STORY-PHY-VARIANT-01 — Choose risk/spice variant
As a risk-seeking customer, I want to choose Mild, Medium, or Hot versions of a pack so that I can pick my preferred volatility.

Acceptance criteria:
- Variant selection changes value bands and risk label.
- Variant price and return policy are clear.
- Draw request records selected variant ID.
- Proof/result snapshots include selected variant configuration.

### Epic PHY-E3 — Trust the pack pool

#### STORY-PHY-TOPHITS-01 — See top hits
As a customer, I want to see top possible pulls with grade and value metadata so that I know what I am chasing.

Acceptance criteria:
- Top hits show image, display name, grade/company, and reference value if configured.
- Top hits are pack/vendor-scoped.
- Out-of-stock top hits are removed or labeled according to policy.
- Featured list is snapshotted or otherwise consistent with customer-facing claims.

#### STORY-PHY-RECENT-01 — See recent pulls
As a customer, I want to see recent pulls so that I know people are actively drawing real items.

Acceptance criteria:
- Feed is vendor-scoped and optionally pack-scoped.
- User identity is anonymous by default.
- Each feed item maps to a real draw result.
- Feed excludes private/hidden results.

### Epic PHY-E4 — Draw and own the result

#### STORY-PHY-DRAW-01 — Paid draw creates durable ownership
As a customer, I want a paid draw to atomically debit my wallet, select a prize, create proof, and add the prize to my inventory so that I never lose points without receiving a traceable result.

Acceptance criteria:
- Wallet debit, draw result, proof snapshot, and user prize inventory record commit in one transaction.
- Idempotency key prevents duplicate debit on retry.
- Failure rolls back all side effects.
- Result page links to inventory and proof.

#### STORY-PHY-RESULT-01 — Choose what to do after draw
As a customer, I want the result page to show available next actions so that I know whether I can keep, return, or fulfill the prize.

Acceptance criteria:
- Result page shows keep/inventory by default.
- Return-to-points action appears only for eligible owned prizes.
- Fulfillment request appears only for fulfillable physical prizes.
- Unsupported trade/sell marketplace actions are hidden until implemented.

### Epic PHY-E5 — Liquidity and onboarding

#### STORY-PHY-RETURN-01 — Return eligible prize to points
As a customer, I want to convert an eligible prize back into points so that I can keep playing without manual support.

Acceptance criteria:
- Return amount is shown before confirmation.
- Operation is idempotent.
- Wallet ledger records credit with source userPrizeId.
- Prize status changes to RETURNED_TO_POINTS and cannot be returned again.

#### STORY-PHY-DEMO-01 — Try demo spin
As a new customer, I want to try a demo spin so that I understand the pack-opening experience before funding.

Acceptance criteria:
- Demo mode is visibly labeled.
- Demo mode uses demo-only pool/data.
- Demo creates no real ledger, proof, or inventory record.
- Demo result cannot be redeemed or returned.

### Epic PHY-E6 — Vendor operations and safety

#### STORY-PHY-ADMIN-01 — Configure pack family/tier/variant
As a vendor operator, I want to configure categories, pack families, tiers, and variants so that I can merchandise packs like a real storefront.

Acceptance criteria:
- Admin can assign category, family, tier label/rank, variant label, and active state.
- Public API returns this structure.
- Vendor A cannot edit or view Vendor B configuration.

#### STORY-PHY-ADMIN-02 — Validate customer-facing claims before publish
As a vendor operator, I want publish validation to block invalid odds, EV, top hits, and return policy so that I do not publish misleading packs.

Acceptance criteria:
- Publish validation checks price, stock, value bands, proof snapshot, featured prize availability, and return policy.
- Validation errors are field-specific.
- Published snapshot is immutable for already-completed draws.

#### STORY-PHY-SUPPORT-01 — Trace public recent pull to private support record
As support, I want to trace a public recent-pull item to the private draw/order/proof/inventory record so that I can resolve disputes quickly.

Acceptance criteria:
- Support lookup can find draw by public feed ID, draw ID, order ID, or proof ID.
- Lookup enforces role/vendor scope.
- Support sees wallet entries, proof, inventory status, and public projection state.

## Recommended Oripa SaaS backlog impact

P0 / MVP-critical:
- Fix wallet/user scoping everywhere sensitive.
- Paid draw atomic ledger/result/proof/inventory.
- Return-to-points policy and user prize status.
- Publish validation baseline.
- Pack categories and safe pack detail disclosure.

P1 / near-MVP conversion:
- Pack family/tier ladder.
- Top hits structured metadata.
- Value-band disclosures.
- Recent pulls projection.
- Support lookup tied to public/private records.

P2 / after stability:
- Spice/risk variants.
- EV computation/display policy.
- Demo spin.
- More advanced privacy controls and top-hit availability snapshots.

Roadmap:
- Marketplace/trading.
- Self-serve shipping.
- Vault custody metadata.
- Web3/NFT/wallet integration.

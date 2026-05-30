# Phygitals-Derived CAR and Customer Stories Proposal for Oripa SaaS — Oracle Revised

Source reference: `docs/reference-phygitals-deep-dive.md`
Shared core: `docs/oripa-core-car-and-customer-stories.md`
Oracle review applied: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/oripa-saas-phygitals-collectorcrypt-proposals-review-1.md`

## Verdict after revision pass 1

Phygitals should influence Oripa SaaS mainly at the storefront/merchandising/disclosure layer. It strengthens, but should not duplicate, shared core requirements around atomic draw, prize entitlement inventory, return-to-points, support trace, publish safety, public result projection, pack status, and claim safety.

## What Phygitals uniquely contributes

- Category-led discovery across TCG and sports categories.
- Price-tiered pack ladders within category/family.
- Risk/spice variants such as Mild/Medium/Hot.
- Pack value-band disclosure and EV-like merchandising.
- Featured top-hit showcase.
- Recent-pulls social proof.
- Demo spin onboarding.
- Return-rate merchandising such as 85–90%, but Oripa MVP must express this as return-to-points only if implemented.

## Strengthened shared core CARs

Phygitals evidence strengthens these shared requirements:

- `CORE-CAR-03` — pack pool snapshot and draw configuration versioning.
- `CORE-CAR-05` — return-to-points policy and ledger credit.
- `CORE-CAR-07` — publish-time draw safety validation.
- `CORE-CAR-09` — public result projection with privacy controls.
- `CORE-CAR-10` — customer-facing claim safety policy.
- `CORE-CAR-11` — pack operational status and emergency stop.
- `CORE-CAR-12` — draw-time disclosure snapshot.

## Phygitals-specific CARs

### PHY-CAR-01 — Category-led pack discovery

- **Challenge:** Customers need to find packs by collecting interest quickly, and vendors need to expand beyond one franchise without hardcoded UI.
- **Action:** Add category navigation with vendor-scoped category records: slug, label, icon/image, display order, active state.
- **Result:** Customers can browse Pokémon, One Piece, sports, and future categories without a flat noisy pack list.
- **Priority:** P1 after P0 draw/wallet/inventory safety.
- **Acceptance:** Category filters are vendor-scoped; empty/inactive categories are hidden or safely labeled; API and UI tests cover tenant boundaries.

### PHY-CAR-02 — Pack family and price-tier ladder

- **Challenge:** Customers need a clear progression from entry-level to high-end packs within one category.
- **Action:** Model pack family/tier metadata: familyId, tierLabel, tierRank, display price/points, sibling pack links.
- **Result:** Storefront can show Starter/Rookie/Elite/Legend/Platinum-style ladders and help customers compare budget levels.
- **Priority:** P1.
- **Acceptance:** Sibling tiers sort deterministically; unavailable tiers are disabled; pack detail links sibling tiers without enabling unavailable draws.

### PHY-CAR-03 — Featured possible pulls / top-hit showcase

- **Challenge:** Customers want to understand upside without scanning a complete internal prize pool.
- **Action:** Add featured prize projection with `isFeatured`, `featuredRank`, display image, grade metadata, and reference value/source.
- **Result:** Customers can see representative high-upside prizes while copy remains availability-safe.
- **Priority:** P1.
- **Acceptance:** Featured cards are vendor/pack scoped; removed/reserved/awarded top hits are hidden or relabeled based on display mode; copy avoids “available” unless item-level availability is true.

### PHY-CAR-04 — Snapshot-backed value-band disclosure

- **Challenge:** Mystery packs need risk/reward explanation, but “live odds” is unsafe unless computed from active pool.
- **Action:** Add value-band disclosure rows with lower/upper value, label/color, weightBps, display order, and snapshot/version source.
- **Result:** Customers can understand configured risk profile before drawing.
- **Priority:** P1 if simple configured bands; P2 if computed from active pool.
- **Acceptance:** Weights total 10000 bps; publish fails if active pool cannot support displayed distribution; draw-time snapshot captures the bands shown to customer.

### PHY-CAR-05 — Approved expected value display policy

- **Challenge:** EV can be persuasive but misleading if stale, manually wrong, or not linked to active pool.
- **Action:** Add EV display policy: hidden, manually configured with source, or computed from active pool snapshot with timestamp.
- **Result:** Oripa can hide EV by default and only show it when defensible.
- **Priority:** P2.
- **Acceptance:** EV hides when snapshot is stale; admin cannot publish computed EV without valid computation; support can see EV shown at draw time.

### PHY-CAR-06 — Risk/spice variants

- **Challenge:** Customers may want the same category/price point with different volatility.
- **Action:** Add pack variants with risk label, display label, value-band set, return policy, operational status, and selected variant snapshot.
- **Result:** Oripa can offer Mild/Medium/Hot-style risk choice while preserving proof/snapshot traceability.
- **Priority:** P2.
- **Acceptance:** Variant selection changes displayed value bands and draw config; selected variant is stored in draw request/result/proof snapshot; disabled variants cannot be drawn.

### PHY-CAR-07 — Demo spin onboarding

- **Challenge:** New customers may hesitate to fund before understanding the reveal flow.
- **Action:** Add demo-only opening mode using sample pool/data and explicit “demo only” copy.
- **Result:** Customers can experience pack opening without financial or prize side effects.
- **Priority:** P2.
- **Acceptance:** Demo creates no wallet ledger, no real proof, no user prize record, no public pull projection, and no support money/prize record.

### PHY-CAR-08 — Pack detail conversion surface

- **Challenge:** Customer confidence depends on seeing price, status, category, top hits, value disclosure, return eligibility, and proof/disclosure rules in one place.
- **Action:** Redesign pack detail contract to return a customer-safe view model derived from pack version/snapshot policy.
- **Result:** Web can render a coherent pack page without directly exposing internal draw configuration.
- **Priority:** P1.
- **Acceptance:** API includes category, family/tier, status, price, featured pulls, safe value bands, return policy summary, proof/disclosure summary, and unavailable reason when disabled.

## Phygitals-specific customer stories

### STORY-PHY-CAT-01 — Browse packs by category
As a customer, I want category navigation so that I can quickly find packs matching my collecting interest.

Acceptance criteria:
- Categories are vendor-scoped.
- Category cards/tabs show label and icon/image.
- Selecting a category filters packs.
- Cross-tenant category data is never returned.

### STORY-PHY-TIER-01 — Compare pack tiers in a category
As a customer, I want to compare pack tiers in the same category so that I can choose a budget level.

Acceptance criteria:
- Pack cards show category, tier label, price/points, status, and image.
- Sibling tiers sort by tier rank and price.
- Disabled/out-of-stock tiers cannot be opened.

### STORY-PHY-TOPHITS-01 — View featured possible pulls
As a customer, I want to see featured possible pulls so that I understand upside before spending.

Acceptance criteria:
- Featured pull cards show image, name, grade/reference metadata, and safe value label.
- Copy says “featured possible pulls” unless item availability is guaranteed.
- Awarded/reserved/removed items are hidden or relabeled by policy.
- Draw-time disclosure snapshot captures featured display mode if shown.

### STORY-PHY-BANDS-01 — View configured value bands
As a customer, I want to see configured value bands so that I understand the risk/reward distribution.

Acceptance criteria:
- Bands show customer-safe value ranges and percentages.
- Publish validation rejects bands that do not total 10000 bps.
- UI copy does not say “live odds” unless active-pool odds are computed.
- Draw-time snapshot stores displayed bands.

### STORY-PHY-VARIANT-01 — Select risk/spice variant
As a risk-seeking customer, I want to choose Mild, Medium, or Hot variants so that I can choose my preferred volatility.

Acceptance criteria:
- Variant label and risk description are clear.
- Variant price/return policy/value bands are visible before draw.
- Disabled variants cannot be purchased.
- Selected variant is included in result and support trace.

### STORY-PHY-DEMO-01 — Try demo spin safely
As a new customer, I want a demo spin so that I can learn the opening UX before funding.

Acceptance criteria:
- Demo is clearly labeled as non-real.
- Demo cannot create prize entitlement or wallet ledger entries.
- Demo result cannot be returned, fulfilled, or shown in public winners.

### STORY-PHY-PACKDETAIL-01 — See all pack decision info before draw
As a customer, I want one pack detail page with price, status, top hits, value bands, return policy, and proof/disclosure summary so that I can make an informed decision.

Acceptance criteria:
- Page blocks draw when pack is paused/out-of-stock/archived.
- Page shows return-to-points only when implemented and eligible.
- Page shows proof/disclosure summary linked to customer-safe explanation.
- Page does not expose internal seed/security fields.

## Recommended Oripa SaaS impact from Phygitals

### P1 near-MVP

- Category-led pack discovery.
- Pack family/tier metadata.
- Featured possible pulls with safe copy.
- Pack detail view model.
- Simple configured value bands only if snapshot-backed.

### P2 growth

- Spice/risk variants.
- EV display policy and computation.
- Demo spin.
- Recent-pulls/public result projection if not already covered by core.

### Roadmap / non-goals

- Marketplace trading.
- Peer-to-peer transfer.
- NFT/digital ownership bridge.
- Cash buyback.
- Self-serve shipping automation.

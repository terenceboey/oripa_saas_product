# Oracle Question — Reconcile Clove Reference Capture Plan with Oripa Creative Generator

## Current proposal to review

We want to gather Clove campaign/banner references as inspiration for Oripa's AI-assisted Campaign Creative Generator. The proposed capture workflow is:

1. Prefer full-page screenshots plus source URLs for each Clove campaign/page/banner.
2. If banners are separate images, download the clean banner image and also capture a page-context screenshot showing placement/CTA/layout.
3. If there are many banners, compile a zip with:
   - `README.md`
   - `sources.csv`
   - desktop screenshots
   - mobile screenshots
   - page-context screenshots
4. `sources.csv` fields:
   - id
   - filename
   - url
   - capture_date
   - context
   - notes
5. Keep scope small:
   - 5–10 desktop banners
   - 5–10 mobile banners if materially different
   - 2–3 full-page context screenshots
   - any campaign/product detail pages with strong styling
6. Send the zip to GPT/Oracle with explicit instruction:
   - Analyze references to extract reusable ecommerce campaign design principles for Oripa.
   - Do not reproduce exact assets, wording, logos, characters, brand marks, layouts, or trade dress.
   - Distill safe template families, composition rules, color/mood patterns, typography direction, CTA treatment, card/product staging rules, and negative prompts.

## Existing Oripa architecture to preserve

- The Campaign Creative Generator should be a job/asset subsystem, not polluted into `VendorBanner`.
- GPT Image 2 generates background/ambience only.
- Oripa deterministically composites exact source-backed `CatalogItem` card images, text, CTA, final crop/layout.
- Publishing final approved assets into existing `VendorBanner.imageUrl` is the only path that touches the current banner display model.
- MVP uses controlled templates/presets, not raw vendor prompts.

## Decision needed

Reconcile the reference-capture plan with the previously reviewed Oripa creative-generator architecture.

Please answer:

1. Is this reference-pack workflow safe/useful, or does it create avoidable legal/IP/trade-dress risk?
2. What should be added/removed from the capture format before using it with GPT/Oracle?
3. What should the downstream analysis output be, so implementation gets safe `CreativeTemplate` specs rather than a copycat design brief?
4. What specific constraints should be imposed on GPT Image 2 prompts and deterministic compositor templates based on these references?
5. What is the safest MVP path: capture references now, wait for legal/product approval, or only use generic ecommerce principles without competitor screenshots?
6. What should be blocked until explicit approval?

Give a concise verdict and a revised plan if needed.

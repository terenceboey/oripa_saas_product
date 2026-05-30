# Campaign Creative Generator — Oracle Review Pass 1

Source response: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T070721Z_oripa-campaign-creative-generator-architecture-pass1-noattachments/oracle_response.md`

## Verdict

CLEAN for architecture, BLOCKED for production launch until gates are resolved.

## Oracle's strongest recommendation

Use GPT Image 2 as a background/style generator only. Deterministically composite exact CatalogItem card art, title text, CTA, and final banner geometry in Oripa's backend.

## Production blockers

1. CatalogItem provenance/images must be reliable enough for source-backed card selection.
2. Object storage/CDN abstraction must be chosen and wired.
3. Legal/product approval is needed for promotional use of Pokémon/TCG card imagery in vendor banners.
4. OpenAI GPT Image 2 org/model access must be confirmed; org verification may be required.
5. DB migrations/live write paths require explicit approval and backup/snapshot gates.

## Architectural conclusions

- New job/asset subsystem, not `VendorBanner.aiPrompt`.
- Existing `VendorBanner` remains storefront display contract.
- `publish-banner` adapter is the only new module path that writes `VendorBanner`.
- MVP source of card truth is `CatalogItem`; no free-text card names.
- Use BullMQ async jobs, not synchronous Express requests.
- Add storage abstraction with local dev adapter and S3/R2-style production adapter.
- Use Image API for MVP one-shot background generation; defer Responses API multi-turn editor.
- Use `sharp`/deterministic compositor for cards/text/layout.

## Plan artifact produced

`docs/plans/campaign-creative-generator-plan.md`

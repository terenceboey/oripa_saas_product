# Campaign Creative Generator — Oracle Input Evidence

## User request
Vendors should be able to generate Oripa-style campaign images using GPT Image 2. Vendor input should be simple: list/select the highlighted cards for the desired campaign. Pipeline should arrange/prompt with GPT Image 2 and generate campaign images aligned with Oripa's campaign style.

## Current repo baseline

### Existing banner data model
`prisma/schema.prisma` has `VendorBanner`:
- `id`, `vendorId`, `title`, `imageUrl`, `targetUrl`, `sortOrder`, `isActive`, timestamps
- relation to `Vendor`
- index `[vendorId, isActive, sortOrder]`

### Existing banner API
`apps/api/src/modules/banners/router.ts`:
- `GET /v1/banners` returns active vendor banners for storefront.
- `GET /v1/vendor/banners` returns all vendor banners to vendor staff/manager/owner.
- `POST /v1/vendor/banners` creates banner from `createBannerSchema`.
- `PATCH /v1/vendor/banners/:id` updates own banner.
- `DELETE /v1/vendor/banners/:id` deletes own banner.
- Role guard requires vendor membership; writes require OWNER or MANAGER.

### Existing shared banner schema
`packages/shared/src/index.ts` has `createBannerSchema`:
- `title: string 2..80`
- `imageUrl: url`
- `targetUrl?: url`
- `sortOrder: int 0..999 default 0`
- `isActive: boolean default true`

### Existing storefront display
`apps/web/app/page.tsx`:
- loads `/v1/banners` alongside packs/wallet.
- renders `currentBanner.imageUrl` inside `.banner-wrap` carousel.
- overlay displays `currentBanner.title` and hardcoded `Limited-time campaign`.

### Existing vendor dashboard
`apps/web/app/vendor/page.tsx`:
- one large client component.
- has `Banner` type with `id,title,imageUrl,targetUrl,sortOrder,isActive`.
- has banner form state: `bannerTitle`, `bannerImageUrl`, `bannerTargetUrl`.
- has pack studio, pack prizes, and CatalogSuggestion types.
- Catalog suggestions expose `imageThumbUrl`, `imageLargeUrl`, `imageBaseUrl`, `setName`, `cardNumber`, `rarity`.

### Catalog source direction
Concurrent queue is implementing TCGTracking-backed `CatalogItem` import. `CatalogItem` already has card image URLs (`imageThumbUrl`, `imageLargeUrl`, `imageBaseUrl`) and source provenance. This module should depend on CatalogItem selection where possible, not vendor free-text only.

## Current package baseline / missing infra
`apps/api/package.json` dependencies currently include Express, Prisma, BullMQ, ioredis, zod, etc. There is no visible storage/image dependency found yet (`sharp`, S3/R2 SDK, OpenAI SDK not present in api package baseline). Therefore object storage and image compositing are likely new infra decisions.

## External API evidence from OpenAI docs/web search
- OpenAI docs say GPT Image models include `gpt-image-2` and support generating and editing images from prompts.
- Image API has generations and edits endpoints; Responses API supports image generation as a built-in tool in multi-step flows and accepts image inputs/outputs in context.
- Docs distinguish Image API for one-shot generate/edit versus Responses API for conversational/editable image experiences.
- Docs mention output customization by quality, size, format, compression, and transparent background depending on model support.
- Docs mention organization verification may be required before using GPT Image models.

## Key design hypothesis to review
Do NOT rely on GPT Image 2 to accurately redraw collectible cards. Use GPT Image 2 primarily for background/style/layout atmosphere, then deterministically composite exact source card images from CatalogItem on top. This preserves card identity, text, art, and compliance while still giving vendors AI-generated campaign creative.

## Proposed module name
`Campaign Creative Generator`

## Architecture questions for Oracle
1. Should this be implemented as a new job/asset subsystem rather than extending `VendorBanner` directly?
2. What data model should be added for generated assets/jobs/style templates?
3. Should card selection use `CatalogItem`, pack prizes, or both? What should MVP use?
4. Should rendering be synchronous API, async job, or BullMQ worker?
5. What storage abstraction is safest for generated images and dev/prod parity?
6. What parts should use GPT Image 2, deterministic compositor, or both?
7. What guardrails are needed for vendor-supplied cards/copy, brand style, copyright/card art, prompt injection, quota/cost, and failed generations?
8. What is the smallest implementation plan that is useful without building campaign mechanics?
9. What should be explicitly deferred?

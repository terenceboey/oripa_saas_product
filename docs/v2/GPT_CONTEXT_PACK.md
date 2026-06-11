# GPT_CONTEXT_PACK

## Current focus

Backend handoff for Oripa pack banner creative generation. The frontend demo page has been pruned; a frontend owner can build the UI from the documented backend contracts.

## Product shape

The backend pipeline is:

- Vendor uploads/selects real source images.
- Backend stores or caches those images in private creative storage.
- Vendor/frontend selects one locked prompt-pack template.
- Backend creates a private `CreativeJob` and prompt-draft asset.
- Compiled prompt includes source images plus pack economics: price per draw, total/remaining stock, frozen pool hash, tier odds/tier stock, and draw-limit rules.
- Renderer lane is chosen after job creation:
  - Option A: direct GPT Image 2 API with source images attached as multipart `image[]`.
  - Option B: Hermes/Oracle browser handoff with source images attached in the GPT web app, followed by ingest.
  - Option C: manual external render then candidate upload/manual registration.
- Generated/uploaded images become private `CreativeAsset` candidates.
- Approval remains private review only; public publish remains blocked.

## Core files

- `docs/v2/BANNER_CREATIVE_BACKEND.md`: backend/API handoff contract and renderer-lane docs.
- `docs/v2/WORKFLOW.md`: operator/backend workflow.
- `apps/api/src/modules/creative/router.ts`: source upload/cache, creative job, direct provider, Hermes/Oracle handoff, ingest, manual candidate, review routes.
- `apps/api/src/modules/creative/service.ts`: template registry, prompt compiler, pack economics formatting, candidate metadata helpers.
- `apps/api/src/lib/creative-storage.ts`: private storage for source images, cached pack-prize images, handoff outputs, and generated candidates.
- `apps/api/src/lib/gpt-image2-provider.ts`: direct GPT Image 2 `/v1/images/edits` adapter with attached source images.
- `apps/api/src/lib/hermes-web-handoff.ts`: Hermes/Oracle browser handoff packet writer and launcher.
- `packages/shared/src/banner-template-pack.ts`: shared 90 locked gacha banner prompt-pack templates.
- `packages/shared/src/index.ts`: shared Zod/API schemas including `createCampaignCreativeSchema`.
- `apps/api/scripts/test-campaign-creative-mvp.ts`: backend contract coverage for source images, prompt draft, candidates, review, storage, and handoff helpers.
- `apps/api/scripts/test-banner-template-demo-contract.ts`: locked-template registry contract coverage.

## Local storage

- Source upload root: `/mnt/archive/oripa-creative-storage/private/source-assets/`
- Pack-prize image cache root: `/mnt/archive/oripa-creative-storage/private/card-assets/pack-prizes/`
- Hermes/Oracle handoff root: `/mnt/archive/oripa-creative-storage/private/hermes-handoffs/`
- Banner candidate storage root: `/mnt/archive/oripa-creative-storage/private/creative-jobs/`
- Private storage URL handles: `/creative-storage/private/...` are identifiers for backend/provider/handoff code, not an unauthenticated static file surface.

## Current limitations

- No final vendor frontend in this PR.
- Direct GPT Image 2 needs `OPENAI_API_KEY` and provider access in the runtime environment.
- Hermes/Oracle browser handoff needs a logged-in browser profile and can be blocked by login/CAPTCHA/rate limits.
- Direct provider generation is synchronous and should move to an async queue before production volume.
- No public publish gate yet; private approval is not storefront publish.
- No legal/IP/claim checker yet; generated banners must be reviewed before public use.
- No production DB writes were performed during this handoff.

## Verification standard

Report exact commands and outputs. Do not claim a production-ready public banner pipeline unless API, database, vendor session, source image storage, selected renderer, generated candidate persistence, private review, and public publish gate are all exercised in the target environment.

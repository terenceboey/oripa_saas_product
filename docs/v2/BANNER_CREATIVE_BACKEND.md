# Banner Creative Backend

This document is the handoff contract for the Oripa pack banner generation backend. The frontend in this PR is intentionally pruned: a separate frontend owner can build the vendor UX against these API contracts.

## What this backend supports

The backend supports three renderer lanes for the same creative job and source-image packet:

1. **Option A — direct GPT Image 2 provider**
   - Endpoint: `POST /v1/vendor/creative-jobs/:jobId/generate-gpt-image-2`
   - Provider adapter: `apps/api/src/lib/gpt-image2-provider.ts`
   - Reads each uploaded/source image from private creative storage and sends it as multipart `image[]` to `https://api.openai.com/v1/images/edits`.
   - Requires `OPENAI_API_KEY` and optional `ORIPA_GPT_IMAGE_MODEL` (default: `gpt-image-2`).
   - Persists returned images as private `CreativeAsset` candidates with `providerMode: "direct_gpt_image_2"`.
   - This is the cleanest production-shaped renderer once provider access, spending controls, retries, and async job handling are ready.

2. **Option B — Hermes / Oracle browser handoff**
   - Start endpoint: `POST /v1/vendor/creative-jobs/:jobId/hermes-gpt-web-handoff`
   - Ingest endpoint: `POST /v1/vendor/creative-jobs/:jobId/hermes-handoffs/:handoffId/ingest`
   - Backend writes a handoff packet under private storage with prompt, source image handles, negative prompt, and pack economics.
   - Hermes/Oracle browser automation opens the GPT web app, attaches the source images, pastes the compiled prompt, and saves downloaded output images in the handoff folder.
   - Ingest scans the handoff folder and imports new downloaded images as private `CreativeAsset` candidates with `providerMode: "oracle_gpt_web_handoff"`.
   - This lane is for internal/operator-assisted fallback and demos when API access is unavailable. It is not an authority lane and should not auto-publish.

3. **Option C — manual candidate upload / manual row creation**
   - File upload endpoint: `POST /v1/vendor/creative-jobs/:jobId/candidates/upload`
   - JSON/manual endpoint: `POST /v1/vendor/creative-jobs/:jobId/candidates/manual`
   - Operator renders externally, then uploads one to four PNG/JPG/WebP candidates or registers existing private URLs.
   - Backend stores candidates privately with `providerMode: "manual_gpt_image_2"`.
   - This remains the safest fallback when provider credentials, browser login, CAPTCHA, rate limit, or image-generation quality blocks automation.

## Source image contract

source images are mandatory for real pack banners. Do not let the frontend pass arbitrary internet URLs directly into generation. Creative job payloads accept only `/creative-storage/private/...` handles returned by the upload/cache endpoints.

Supported source paths:

- Vendor uploads: `POST /v1/vendor/creative-source-assets/upload`
  - Accepts up to 5 files.
  - Stores under private creative storage.
  - Returns normalized `heroAssets[]` objects: `assetId`, `source`, `imageUrl`, `displayName`, `snapshotHash`, `contentHash`, dimensions, and storage metadata.

- Pack-prize cache/import: `GET /v1/vendor/banner-card-assets?packId=...` and `POST /v1/vendor/banner-card-assets/cache`
  - Reads card/prize images from the vendor-owned pack.
  - Caches selected images into private storage before rendering.
  - Returns source-backed hero card objects for prompt compilation.
  - Creative job creation rejects `heroCardIds[]` until those pack-prize images have cached private storage handles.

Creative job creation accepts either uploaded `heroAssets[]` or pack-prize `heroCardIds[]`:

- Endpoint: `POST /v1/vendor/packs/:packId/creative-jobs`
- Schema: `createCampaignCreativeSchema` in `packages/shared/src/index.ts`
- Required: at least one private `heroAssets[]` entry, or `heroCardIds[]` that can be resolved to an already-cached private pack-prize image
- The backend compiles the hidden prompt and stores it in a private prompt-draft `CreativeAsset`.

## Pack economics contract

The compiled prompt carries source-of-truth pack economics from the pack record:

- price per draw
- total stock and remaining stock
- draw-limit mode/value/timezone
- tier odds and tier stock
- top weighted prize odds where available
- frozen pool/snapshot hash where available
- important notes

The model is allowed to display only safe, reviewable claims. Public publish remains blocked until a later publish gate verifies claims, source cards, ownership, immutable storage, and storefront attachment.

## Frontend boundary for this PR

The old standalone `/vendor/banner-templates` demo page has been removed from the PR. The backend is ready for a frontend owner to build a proper vendor UX around these calls:

1. Select or upload source images.
2. Choose one of the locked templates from `GET /v1/vendor/banner-templates`.
3. Create a private creative job with safe text fields and `heroAssets[]` / `heroCardIds[]`.
4. Choose one renderer lane: Option A direct provider, Option B Hermes/Oracle handoff, or Option C manual upload.
5. Show private candidates and allow approve/reject only.
6. Keep public publish disabled until the publish gate exists.

## Non-goals in this PR

- No public storefront publish.
- No automatic vendor banner attachment to a live pack.
- No production DB migration or seed execution.
- No legal/IP/claim approval automation.
- No background queue yet; direct provider generation is still synchronous and should become async before high-volume production use.
- No frontend UX finalization; boss/frontend owner owns that layer.

## Environment

- `ORIPA_CREATIVE_STORAGE_ROOT`: private storage root. Defaults to `/mnt/archive/oripa-creative-storage`, with local fallback in the API workspace.
- `APP_URL`: optional base used when returning private `/creative-storage/private/...` handles. The API does not mount private creative storage as unauthenticated static content; provider and Hermes handoff code resolve these handles to local files under `ORIPA_CREATIVE_STORAGE_ROOT`.
- `OPENAI_API_KEY`: required only for Option A direct GPT Image 2.
- `ORIPA_GPT_IMAGE_MODEL`: optional direct-provider model override; default is `gpt-image-2`.
- `ORIPA_ENABLE_HERMES_WEB_HANDOFF`: enables the Hermes/Oracle browser handoff launcher where the process environment allows it.
- `ORIPA_HERMES_COMMAND`, `ORIPA_HERMES_TOOLSETS`, `ORIPA_HERMES_PROFILE`: optional Hermes handoff process controls.

## Verification commands

Run before PR handoff:

```bash
npm run build -w @oripa/shared
npm run lint -w @oripa/api
npm run build -w @oripa/api
npm run test:creative:banner-template-demo -w @oripa/api
npm run test:creative:mvp -w @oripa/api
npm test
npm run lint -w @oripa/web
npm run build -w @oripa/web
git diff --check
```

## Proven runtime note

A standard Hermes Oracle browser image-generation run was tested outside the repo code path and produced a real private demo PNG with source images attached. That proves the source-image render concept works. The repo PR should still be reviewed as backend contracts plus docs; production direct GPT Image 2 requires `OPENAI_API_KEY` and provider access in the target environment.

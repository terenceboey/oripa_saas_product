# WORKFLOW

## Banner creative backend workflow

This PR ships backend/API support for pack banner creative generation. The standalone frontend demo was removed so a frontend owner can build the production UX separately.

1. Vendor creates or selects an existing draft/live pack.
2. Vendor provides source images by either:
   - uploading images through `POST /v1/vendor/creative-source-assets/upload`, or
   - selecting pack-prize cards from `GET /v1/vendor/banner-card-assets?packId=...` and caching them with `POST /v1/vendor/banner-card-assets/cache`.
   - Both paths return private `/creative-storage/private/...` handles; frontend must not submit arbitrary external image URLs into creative jobs. If the frontend uses `heroCardIds[]`, it must call the cache endpoint first so the backend can resolve each selected prize to a private handle.
3. Frontend fetches locked prompt-pack templates from `GET /v1/vendor/banner-templates`.
4. Frontend creates a private creative job through `POST /v1/vendor/packs/:packId/creative-jobs` with:
   - `templateId`
   - safe headline/badge/sticker fields
   - `heroAssets[]` for uploaded source images or `heroCardIds[]` for pack-prize cache
   - optional primary card/source selection
5. Backend compiles a hidden prompt and private prompt-draft asset carrying source images plus pack economics: price points, total/remaining stock, tier odds, tier stock, top weighted prize odds, frozen pool hash, and draw-limit rules.
6. Operator/frontend chooses exactly one renderer lane:
   - Option A: `POST /v1/vendor/creative-jobs/:jobId/generate-gpt-image-2` for direct GPT Image 2 API with attached `image[]` source files.
   - Option B: `POST /v1/vendor/creative-jobs/:jobId/hermes-gpt-web-handoff`, then `POST /v1/vendor/creative-jobs/:jobId/hermes-handoffs/:handoffId/ingest` for Hermes/Oracle browser handoff.
   - Option C: `POST /v1/vendor/creative-jobs/:jobId/candidates/upload` or `/candidates/manual` for manual fallback candidates.
7. Backend stores generated/uploaded results as private `CreativeAsset` candidates under private creative storage.
8. Vendor/frontend may approve or reject private candidates.
9. Public publish remains blocked until a separate publish gate validates ownership, source image provenance, claims, immutable storage, and pack/storefront attachment.

## Frontend handoff

- `/vendor/banner-templates` demo UI is no longer part of this PR.
- Boss/frontend owner should build the real vendor UX against the API contracts in `docs/v2/BANNER_CREATIVE_BACKEND.md`.
- Keep direct-provider, Hermes/Oracle handoff, and manual fallback controls as backend-driven actions, not hard-coded browser-only demos.

## Required verification commands

- `npm run build -w @oripa/shared`
- `npm run lint -w @oripa/api`
- `npm run build -w @oripa/api`
- `npm run test:creative:banner-template-demo -w @oripa/api`
- `npm run test:creative:mvp -w @oripa/api`
- `npm test`
- `npm run lint -w @oripa/web`
- `npm run build -w @oripa/web`
- `git diff --check`

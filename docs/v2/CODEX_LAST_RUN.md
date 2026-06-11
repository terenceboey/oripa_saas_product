# CODEX_LAST_RUN

## 2026-06-11 banner creative backend PR handoff

Branch: `feature/oripa-parity-main-integration-20260609T082259`

## Changed

- Pruned the standalone `/vendor/banner-templates` frontend demo page from this PR so the frontend owner can rebuild the vendor UX cleanly.
- Kept the backend banner creative substrate:
  - source image upload/cache routes
  - 90 shared locked prompt-pack templates
  - prompt compiler with pack economics
  - private creative jobs and private candidate assets
  - direct GPT Image 2 provider adapter with attached source images
  - Hermes/Oracle browser handoff and ingest path
  - manual candidate upload/manual registration fallback
- Removed the unauthenticated demo Hermes handoff route; renderer actions now use vendor-scoped routes.
- Renamed the direct provider adapter/metadata away from Oracle wording:
  - provider file: `apps/api/src/lib/gpt-image2-provider.ts`
  - direct provider candidate mode: `direct_gpt_image_2`
- Added backend handoff docs in `docs/v2/BANNER_CREATIVE_BACKEND.md`.
- Hardened the handoff substrate after pre-PR review:
  - no unauthenticated `/creative-storage` static mount for private assets/prompts/logs
  - creative job and manual candidate payloads accept only `/creative-storage/private/...` image handles
  - direct GPT Image 2 reads source images from local private storage instead of fetching arbitrary URLs
  - pack-prize remote image caching blocks localhost/private-network URLs, enforces image content type, timeout, and 15MB byte limit
  - remote card-image cache binds the request to a vetted DNS result and rejects redirects
  - `heroCardIds[]` are hydrated to cached private handles before prompt compilation; uncached/raw prize URLs are rejected for provider/handoff generation
  - Hermes handoff local-path resolution rejects path traversal outside the creative storage root
  - Hermes handoff requires explicit `ORIPA_ENABLE_HERMES_WEB_HANDOFF=1` and receives a minimal child env
  - upload routes authenticate before multipart memory parsing

## Renderer lanes

- Option A: direct GPT Image 2 API through `POST /v1/vendor/creative-jobs/:jobId/generate-gpt-image-2`.
- Option B: Hermes/Oracle browser handoff through `POST /v1/vendor/creative-jobs/:jobId/hermes-gpt-web-handoff` and ingest through `/hermes-handoffs/:handoffId/ingest`.
- Option C: manual fallback through `/candidates/upload` or `/candidates/manual`.

## Known gaps

- No final frontend UX in this PR.
- No public publish gate.
- Direct GPT Image 2 requires `OPENAI_API_KEY` and provider access.
- Hermes/Oracle browser generation requires logged-in ChatGPT browser state.
- Direct provider generation is synchronous and should become async before production volume.
- Private creative-storage handles are backend/provider identifiers, not public static image URLs.

## Verification

Use the exact verification list in `docs/v2/WORKFLOW.md` before PR handoff. Do not claim public-launch readiness; this is backend/demo-render foundation only.

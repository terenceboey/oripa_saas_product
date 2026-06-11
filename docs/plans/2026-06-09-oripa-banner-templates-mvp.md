# Oripa Banner Creative Backend PR Plan

**Goal:** ship the backend substrate for pack banner creative generation while leaving final vendor frontend UX to the frontend owner.

## Scope

- Shared locked prompt-pack template registry with 90 banner themes.
- Vendor-scoped source image upload/cache contracts.
- Creative job prompt compiler that carries real pack economics into the hidden prompt.
- Private candidate storage and review metadata.
- Three renderer lanes:
  - Option A direct GPT Image 2 provider with attached source images.
  - Option B Hermes/Oracle browser handoff with ingest back into Oripa.
  - Option C manual candidate upload/manual registration fallback.
- Backend docs for frontend handoff.

## Non-goals

- No final `/vendor/banner-templates` frontend UI in this PR.
- No public publish gate or public storefront banner attachment.
- No production DB migration/seed execution.
- No legal/IP/claim automation.
- No high-volume async queue yet.

## Acceptance criteria

- Backend can create a private creative job from `heroAssets[]` or `heroCardIds[]`.
- Compiled prompt includes pack economics and safe claim warnings.
- Direct provider path attaches images and persists returned images as private candidates when credentials are available.
- Hermes/Oracle handoff writes a packet with prompt/images/economics and has an ingest path for downloaded outputs.
- Manual fallback stores uploaded/rendered images as private candidates.
- Frontend demo artifacts are pruned from the PR.
- Docs clearly tell the frontend owner which backend contracts to wire.

## Verification

See `docs/v2/WORKFLOW.md` for the current command list.

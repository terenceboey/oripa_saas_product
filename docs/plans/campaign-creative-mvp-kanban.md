# Campaign Creative MVP — Bounded Kanban Queue

## Definition of done
- Vendor can request a creative draft from an existing pack.
- Request is pack-anchored: all visible card candidates are selected from `PackPrize` rows.
- Prompt contract is IP-safe: generated provider prompt contains only abstract style/layout tokens and never card/franchise/set/character/logo/artist/card-text identity.
- MVP generation is deterministic/mock-safe: it produces a private draft asset without calling an image provider or publishing public banners.
- Publish remains blocked until legal/commercial-use and immutable-storage gates are implemented.
- API/shared/web builds pass, and a targeted script proves prompt safety + pack snapshot behavior.

## Non-goals for this MVP
- No CSV import.
- No live DB migration or Render DB write.
- No external AI provider call.
- No public publish/activation of banners.
- No legal conclusion about card image usage.

## Queue

### Done criteria tags
- **Schema**: Prisma schema compiles and can generate client.
- **API**: endpoints compile and enforce vendor/pack scoping.
- **Safety**: prompt excludes protected terms.
- **UI**: vendor can start generation and see draft assets.
- **Verification**: targeted test/build output captured.

### To do / In progress / Done
1. **KBN-001 — Schema foundation** `[Schema]`
   - Add creative job/asset lifecycle enums and tables.
   - Add PackPrize catalog snapshot fields used by deterministic card overlay.
   - Acceptance: `npx prisma generate --schema prisma/schema.prisma` succeeds.

2. **KBN-002 — Prompt/compositor core** `[Safety]`
   - Pure module builds a safe abstract provider prompt and a deterministic private SVG preview.
   - Acceptance: targeted script fails if protected terms leak into prompt.

3. **KBN-003 — Vendor API** `[API]`
   - `POST /v1/vendor/packs/:packId/creative-jobs` creates a completed MVP draft job and asset.
   - `GET /v1/vendor/creative-jobs` lists vendor draft jobs/assets.
   - `POST /v1/vendor/creative-jobs/:jobId/publish` returns a gated 409 with explicit blockers.
   - Acceptance: API build passes.

4. **KBN-004 — Vendor UI slice** `[UI]`
   - Pack studio has “Generate creative draft” action.
   - Dashboard shows private creative drafts and blocked-publish status.
   - Acceptance: web build passes.

5. **KBN-005 — Final verification / handoff** `[Verification]`
   - Run shared/API/web/worker builds where touched.
   - Run targeted creative MVP test script.
   - Report exact evidence and blockers.

## Current status
- KBN-001: done — Prisma schema validates and client generation passed.
- KBN-002: done — targeted guardrail script proves prompt leak detection and deterministic asset hash.
- KBN-003: done — creative API routes compile and are registered in the Express app.
- KBN-004: done — vendor page builds with generation, private draft gallery, and publish gate check UI.
- KBN-005: done — verification evidence captured in final handoff.

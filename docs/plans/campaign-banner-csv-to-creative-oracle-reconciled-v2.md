# Campaign Banner CSV → Pack → Creative — Oracle-Reconciled Architecture v2

## Executive decision

Build this as a **two-stage pack-import + creative-generator pipeline**, not a direct CSV-to-AI-image shortcut.

```text
CSV row
→ resolved source-backed CatalogItem
→ frozen PackPrize catalog snapshot
→ creative job item sourced from PackPrize
→ private draft candidate asset
→ immutable public VendorBanner asset after explicit publish
```

This satisfies the boss flow:

```text
Vendor uploads CSV containing item/card names
→ System generates pack contents from those items
→ Vendor clicks/prompts Generate Image
→ System returns 1-3 generated banner candidates based on vendor-safe brief + exact pack contents
```

Key product interpretation: “based on prompt + contents inside” means AI generates **abstract backgrounds/style variants**, while Oripa deterministically composites exact card images and text from the pack contents. Do **not** ask the AI image model to redraw cards, card text, logos, characters, or full banners.

## Current repo evidence

Inspected repo seams:

- `apps/api/src/modules/banners/router.ts`: existing `VendorBanner` CRUD, publish target remains this contract.
- `packages/shared/src/index.ts`: `createBannerSchema`, `createPackSchema` exist.
- `apps/api/src/modules/catalog/router.ts`: source-backed `CatalogItem` search exists; batch matching should use direct service/helper, not call HTTP internally.
- `apps/api/src/modules/packs/router.ts`: existing pack creation should be reused for semantics/invariants.
- `prisma/schema.prisma`:
  - `Pack.status` already supports `DRAFT`.
  - `PackPrize` currently lacks catalog identity fields; this is a P0 migration.
  - `IdempotencyKey` exists but is too narrow for multi-route import/creative/publish locking.
- `apps/api/src/queue.ts`: only `draw-jobs` exists.
- `apps/worker/src/index.ts`: placeholder `draw-jobs` worker only.
- `apps/web/app/vendor/page.tsx`: monolithic vendor UI; add import/creative sections carefully or extract components.
- No CSV upload/parser infrastructure found.

Prior docs considered:

- `docs/plans/campaign-creative-generator-plan.md`
- `docs/plans/campaign-creative-generator-oracle-review.md`
- `docs/plans/campaign-creative-reference-capture-oracle-reconciled.md`
- `docs/plans/campaign-banner-csv-to-creative-oracle-input.md`
- Oracle v1 response: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T145719Z_campaign-banner-csv-creative-architecture-v1/oracle_response.md`

## Hard gates before implementation

These are not nice-to-have residuals. They decide whether the feature can ship.

1. **Legal/card-image gate**
   - Promotional banner use of exact TCG card images must be approved.
   - If legal/product only allows catalog/product display but not advertising, scope changes to abstract no-card banners or vendor-uploaded licensed art.
   - Track allowed games/sources/jurisdictions and required disclaimers in a `CreativeLegalPolicy` config/table.

2. **PackPrize identity gate**
   - `PackPrize.catalogItemId` + frozen snapshot fields are required before creative generation from pack contents.
   - Imported catalog prizes without identity are not creative-eligible.

3. **Object storage/security gate**
   - Production needs private draft storage + immutable public published storage.
   - Cloudflare R2 is recommended, but any S3-compatible store must support CORS, private draft reads/signed URLs, public banner URLs, and content-hashed keys.

4. **Provider access gate**
   - Verify actual image model/provider access in the deployment account before promising GPT/OpenAI-specific behavior.
   - Provider must support policy/moderation requirements and acceptable latency/cost.

5. **Pack mechanics gate**
   - Define row-to-prize contract, stock/weight defaults, odds/economics constraints, and commit validation against existing draw logic before auto-creating packs.

## Non-goals

- No AI-redrawn card faces, official logos, card text, franchise characters, or full banner layout.
- No auto-publish to storefront.
- No campaign coupons/discounts/odds claims/analytics/A-B tests in MVP.
- No arbitrary off-platform target URLs.
- No competitor screenshot/reference prompting.
- No production DB migration/write without explicit approval.

## Required DB/schema contracts

### 1. Upgrade idempotency

Existing `IdempotencyKey` has `scopeKey`, `statusCode`, `responseJson`; keep compatible if desired, but import/creative/publish need transactional lock semantics.

Recommended additive fields or v2 table:

```prisma
model IdempotencyKey {
  id                  String   @id @default(cuid())
  key                 String
  operation           String
  scopeKey            String   @unique
  vendorId            String
  userId              String?
  requestId           String?
  requestHash         String?
  status              String?  // IN_PROGRESS | SUCCEEDED | FAILED
  statusCode          Int?
  responseJson        String?
  createdResourceType String?
  createdResourceId   String?
  expiresAt           DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([vendorId, operation, createdAt])
}
```

Commit/publish must use guarded state transitions plus idempotency, not blind create.

### 2. PackPrize catalog identity is mandatory

Add fields:

```prisma
model PackPrize {
  // existing fields...
  catalogItemId          String?
  catalogSource          String?
  catalogSourceItemId    String?
  catalogSnapshotJson    Json?
  catalogSnapshotHash    String?
  sourceImportRowId      String?
  sourceCatalogImageUrl  String?
  imageStorageKey        String?
  estimatedValueCents    Int?
}
```

Rules:

- Imported source-backed prizes require `catalogItemId` and `catalogSnapshotHash`.
- Manual/legacy prizes may leave `catalogItemId` null, but are not automatically eligible for creative card overlays.
- Creative jobs must source highlights by `packPrizeId`, not naked `catalogItemId`.

### 3. Pack import models/state machine

```prisma
model PackImportJob {
  id                     String @id @default(cuid())
  vendorId               String
  requestedById          String
  status                 PackImportStatus @default(QUEUED)
  statusVersion          Int @default(1)

  originalFileName       String?
  fileStorageKey         String
  fileSizeBytes          Int?
  inputHash              String?

  csvSchemaVersion       Int @default(1)
  importOptionsJson      Json?
  packDraftSchemaVersion Int @default(1)
  packDraftJson          Json

  rowCount               Int @default(0)
  matchedCount           Int @default(0)
  ambiguousCount         Int @default(0)
  unmatchedCount         Int @default(0)
  invalidCount           Int @default(0)
  skippedCount           Int @default(0)

  createdPackId          String? @unique
  committedAt            DateTime?
  errorCode              String?
  errorMessage           String?

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  rows                   PackImportRow[]

  @@index([vendorId, status, createdAt])
  @@index([inputHash])
}

model PackImportRow {
  id                    String @id @default(cuid())
  importJobId           String
  rowIndex              Int
  rowVersion            Int @default(1)

  rawRowJson            Json
  rawRowHash            String?
  rawCardName           String
  normalizedCardName    String

  game                  String?
  language              String?
  setName               String?
  cardNumber            String?
  variant               String?
  condition             String?
  tier                  String?
  stock                 Int?
  weight                Int?
  estimatedValueCents   Int?

  status                PackImportRowStatus @default(PENDING)
  matchedCatalogItemId  String?
  matchedConfidence     Float?
  matchReason           String?
  suggestionsJson       Json?
  suggestionVersion     Int @default(1)
  validationErrorsJson  Json?

  resolvedById          String?
  resolvedAt            DateTime?
  resolutionNote        String?
  committedPackPrizeId  String?

  @@unique([importJobId, rowIndex])
  @@index([importJobId, status])
  @@index([matchedCatalogItemId])
}
```

Import statuses:

```text
QUEUED → PARSING → MATCHING → NEEDS_REVIEW → READY_TO_COMMIT → COMMITTING → COMMITTED
                                           ↘ FAILED / CANCELLED / EXPIRED
```

Row statuses:

```text
PENDING | INVALID | AUTO_MATCHED | AMBIGUOUS | MANUALLY_RESOLVED | UNMATCHED | SKIPPED | COMMITTED
```

Critical rules:

- `READY_TO_COMMIT` requires zero unresolved required rows.
- `UNMATCHED → SKIPPED` only by explicit vendor action.
- `AMBIGUOUS → MANUALLY_RESOLVED` only after server revalidation.
- `COMMITTED` terminal.
- `FAILED` retry policy depends on error class; invalid CSV is not retryable without new file.

### 4. Creative models/state machine

```prisma
model CampaignCreativeJob {
  id                    String @id @default(cuid())
  vendorId              String
  requestedById         String

  packId                String?
  importJobId           String?
  status                CampaignCreativeJobStatus @default(QUEUED)
  variantCount          Int @default(1)

  templateKey           String
  templateVersion       Int
  promptTemplateKey     String
  promptTemplateVersion Int

  briefRaw              String?
  briefTokens           Json?
  copyClaimsJson        Json?
  copyPolicyStatus      String?

  quotaReservationId    String?
  idempotencyScopeKey   String?
  selectionPolicy       String?

  errorCode             String?
  errorMessage          String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  items                 CampaignCreativeJobItem[]
  assets                CampaignCreativeAsset[]

  @@index([vendorId, status, createdAt])
}

model CampaignCreativeJobItem {
  id                  String @id @default(cuid())
  jobId               String
  packPrizeId         String?
  catalogItemId       String?
  catalogSnapshotJson Json
  catalogSnapshotHash String
  imageStorageKey     String?
  role                String // hero | supporting | hidden_context

  @@index([jobId])
  @@index([packPrizeId])
}

model CampaignCreativeAsset {
  id                   String @id @default(cuid())
  jobId                String
  vendorId             String
  variantIndex         Int
  status               CampaignCreativeAssetStatus @default(EXPECTED)

  backgroundStorageKey String?
  draftStorageKey      String?
  thumbStorageKey      String?
  publishedStorageKey  String?

  width                Int?
  height               Int?
  mimeType             String?
  byteSize             Int?
  contentHash          String?
  etag                 String?

  provider             String?
  providerModel        String?
  providerRequestId    String?
  providerUsageJson    Json?
  providerCostCents    Int?
  providerLatencyMs    Int?
  materializedPromptHash String?
  moderationJson       Json?

  sourceVendorBannerId String?
  publishedAt          DateTime?
  errorCode            String?
  errorMessage         String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([jobId, variantIndex])
  @@index([vendorId, status, createdAt])
}
```

Job statuses:

```text
QUEUED | RUNNING | PARTIAL_SUCCESS | SUCCEEDED | FAILED | CANCELLED | EXPIRED
```

Asset statuses:

```text
EXPECTED | GENERATING_BACKGROUND | COMPOSITING | READY_FOR_REVIEW | APPROVED | PUBLISHED | FAILED | DELETED | EXPIRED
```

### 5. VendorBanner lineage

Existing storefront contract can remain unchanged, but add optional lineage fields:

```prisma
model VendorBanner {
  // existing fields...
  sourceCreativeAssetId String?
  sourceCreativeJobId   String?
  imageStorageKey       String?
  imageContentHash      String?
}
```

Publish copies private draft asset to immutable public banner key and creates/updates `VendorBanner`.

## CSV import architecture

### CSV contract

Boss-demo minimum:

```csv
card_name
Pikachu
Charizard
```

Production-recommended:

```csv
card_name,game,language,set_name,card_number,variant,condition,tier,stock,weight,estimated_value_cents
Pikachu,POKEMON,en,Base Set,58/102,normal,near_mint,A Tier,1,10,10000
```

Server rules:

- Card-name-only rows are review-required unless product explicitly accepts incomplete identity.
- Auto-match only when strong identity fields exist and canonical lookup resolves to exactly one active source-backed `CatalogItem` with usable image/provenance.
- Record `matchedConfidence` and `matchReason` for every auto/manual match.
- `estimatedValueCents` nullable; do not default unknown value to zero.

### API

```text
POST   /v1/vendor/pack-imports                  multipart upload; returns 202 { importId }
GET    /v1/vendor/pack-imports/:id              summary only
GET    /v1/vendor/pack-imports/:id/rows         paginated rows by status/cursor
PATCH  /v1/vendor/pack-imports/:id/resolutions optimistic rowVersion update
POST   /v1/vendor/pack-imports/:id/commit-pack  idempotent transactional commit
```

Upload caps:

```text
max bytes
max rows
max columns
max field length
allowed encodings
parse timeout
duplicate header behavior
unknown column behavior
formula-cell behavior
```

Do not parse large CSV in the request path. Store source file/private normalized copy, enqueue worker, parse via streaming `csv-parse`.

### Matching

For each row:

1. Normalize name, punctuation, whitespace, Unicode.
2. Enforce game/language filters from row/import defaults.
3. If set/card number/variant exists: canonical exact lookup.
4. Else lower(name) exact candidate set.
5. If strong unique identity + active + image/provenance: `AUTO_MATCHED`.
6. Else suggestions top N with `AMBIGUOUS`.
7. Zero candidates: `UNMATCHED`.

Catalog search performance work should land before large CSV batch matching; use direct batched DB queries/helper, not per-row HTTP calls.

### Row-to-prize contract

MVP behavior:

- Each valid matched row creates one `PackPrize`.
- Duplicate `catalogItemId` rows aggregate by default only if all row economics match; otherwise preserve distinct rows.
- `stock` defaults to 1.
- `weight` must be provided or selected from explicit commit option:
  - equal weight across rows, or
  - tier-based preset, or
  - reject until vendor supplies weights.
- `estimatedValueCents` remains nullable if unknown.
- Commit runs existing pack invariants from `createPackSchema`/pack service.
- Commit creates DRAFT pack only.

Commit transition:

```sql
UPDATE PackImportJob
SET status = 'COMMITTING'
WHERE id = $importId
  AND vendorId = $vendorId
  AND status = 'READY_TO_COMMIT'
```

If zero rows affected, return existing committed pack or conflict. Pack creation and row `COMMITTED` updates happen in one transaction.

## Creative generation architecture

### API

```text
GET    /v1/vendor/creative/templates
POST   /v1/vendor/creative/jobs
GET    /v1/vendor/creative/jobs/:id
GET    /v1/vendor/creative/jobs/:id/assets
POST   /v1/vendor/creative/assets/:assetId/publish-banner
DELETE /v1/vendor/creative/assets/:assetId
```

`POST /creative/jobs` accepts pack-centric inputs only:

```json
{
  "packId": "...",
  "templateKey": "premium_drop_split_hero",
  "variantCount": 3,
  "brief": "premium foil collector drop",
  "title": "Weekend Chase Drop",
  "subtitle": "Top hits inside",
  "cta": "View packs",
  "highlightPackPrizeIds": ["..."]
}
```

Rules:

- Server derives source from `packId`/import lineage; client does not send `source`.
- `variantCount` max 3.
- `highlightPackPrizeIds`, not `highlightCatalogItemIds`.
- Highlight pack prizes must belong to the vendor pack, have catalog snapshots, and be creative-eligible.
- `targetUrl` should be server-derived from `packId`; arbitrary external URL not accepted in MVP.
- OWNER/MANAGER can generate/publish; STAFF read-only unless product says otherwise.

### Prompt boundary

Never put card names, franchise names, set names, logos, character names, or card text into the image provider prompt.

Allowed style tokens should be small and generic:

```text
premium_foil
neon_arcade
minimal_luxury
sports_card_showcase
dark_chrome
festive_drop
```

Block/remap risky tokens:

```text
anime-style
Pokemon style
One Piece style
Magic the Gathering style
Disney style
like [artist]
official-looking
logo
mascot
character
```

Provider prompt example:

```text
abstract premium collectible card drop background, dark chrome gradient, foil sparkle, display-safe negative space, no logos, no characters, no trading card faces, no readable text
```

### Copy claims validator

Extract and validate claims from title/subtitle/CTA/brief before generation/publish.

Block or require backing data for:

```text
guaranteed hit
guaranteed profit
best odds
limited time
only 3 left
official
endorsed
licensed
exclusive
discount
free
$100 value
chase guaranteed
```

`copyClaimsJson` example:

```json
{
  "scarcity": true,
  "valueClaim": true,
  "oddsClaim": false,
  "endorsementClaim": false,
  "discountClaim": false
}
```

Validation:

- scarcity requires real inventory/schedule state;
- value claim requires pricing/proof source;
- odds claim requires odds/disclosure approval;
- official/endorsement/licensed claims always blocked unless explicit verified policy.

### Generation pipeline

```text
POST /creative/jobs
→ reserve quota for N variants
→ create job + EXPECTED asset rows with deterministic variant indexes
→ enqueue creative job/variant jobs with deterministic jobId
→ worker loads PackPrize snapshots and template
→ worker maps brief into safe tokens and materializes prompt hash
→ provider generates abstract background only
→ persist provider metadata immediately after provider response
→ upload/cache background to private storage
→ fetch exact card images only from Oripa-controlled cache/storage
→ sharp compositor overlays exact cards + deterministic SVG/text/layout
→ upload draft final + thumb to private storage
→ mark asset READY_FOR_REVIEW
→ job SUCCEEDED or PARTIAL_SUCCESS
→ vendor selects candidate
→ publish copies draft to immutable public banner key and creates VendorBanner lineage
```

Partial success is acceptable: 1 of 3 candidates ready should be reviewable even if others fail.

### Provider abstraction

```ts
interface ImageGenerationProvider {
  generateBackground(input: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    seed?: number;
    quality: 'preview' | 'standard' | 'high';
  }): Promise<{
    image: Buffer;
    provider: string;
    model: string;
    requestId?: string;
    seed?: number;
    usage?: unknown;
    costCents?: number;
    latencyMs?: number;
    moderation?: unknown;
  }>;
}
```

Adapters:

- `mock` for tests/dev.
- `openai` if access verified.
- `fal`/Flux alternative if product accepts vendor/provider/legal profile.

Do not expose provider/model choice to vendors in MVP.

## Storage and asset security

Object classes:

```text
private/vendors/{vendorId}/pack-imports/{importId}/{sha256}.csv
private/vendors/{vendorId}/catalog-cache/{catalogItemId}/{sha256}.webp
private/vendors/{vendorId}/creative/{jobId}/variant-{n}/{sha256}-draft.webp
private/vendors/{vendorId}/creative/{jobId}/variant-{n}/{sha256}-thumb.webp
public/vendors/{vendorId}/banners/{bannerId}/{sha256}.webp
```

Rules:

- Draft/review assets private; serve through signed URLs or authenticated proxy.
- Published assets public, content-hashed, immutable cache headers.
- Never overwrite public keys on retry.
- Do not delete published source assets while `VendorBanner` references them.
- Deleting generated draft is soft delete.

Image fetch security:

- Prefer cached CatalogItem images in Oripa-controlled storage.
- If fetching external catalog image URLs: HTTPS only, host allowlist, no private IPs, max bytes, max dimensions, content-type sniff, redirect cap, download/decode timeout.

## Queue/retry semantics

Queues:

```text
pack-import-jobs
campaign-creative-jobs
creative-variant-jobs optional
asset-cleanup-jobs optional
```

BullMQ options per queue:

```ts
attempts: 3
backoff: { type: 'exponential', delay: 10_000 }
removeOnComplete: { age: 86400 }
removeOnFail: false
concurrency: small bounded number
lockDuration: tuned above provider/image-processing max
limiter: vendor/global provider cap
jobId: deterministic id
```

Provider retry safety:

- Create `CampaignCreativeAsset(EXPECTED)` before provider call.
- Persist provider request/metadata immediately after success.
- Upload background before compositing.
- Retry reuses existing `backgroundStorageKey`; only regenerate by explicit action.
- Treat provider retries as potentially billable where API idempotency is unavailable.

Quota:

- Reserve quota/cost at creative job creation.
- Release/adjust on terminal failure or partial success.
- Enforce per-vendor concurrent job max 1 for MVP and global provider concurrency cap.

## Template/compositor contract

```ts
type CreativeTemplate = {
  key: string;
  version: number;
  width: number;
  height: number;
  safeZones: Rect[];
  cardSlots: Slot[];
  titleBox: TextBox;
  subtitleBox?: TextBox;
  ctaBox?: TextBox;
  maxCards: number;
  supportedAspectRatios: string[];
};
```

Acceptance:

- output dimensions exact;
- cards never passed to AI provider;
- no card face clipped outside slot;
- text crisp and readable;
- deterministic golden-image tests pass for each template;
- max cards/overflow behavior defined.

## Implementation sequence

### Phase 0 — gates + contract spike

- Legal card-image promotional-use decision.
- Confirm role rules.
- Confirm object storage/security posture.
- Confirm provider access/moderation/cost.
- Lock row-to-prize/stock/weight/economics contract.
- Confirm existing `Pack.status = DRAFT` is acceptable.

### Phase 1 — schema/idempotency/storage foundation

- Add/upgrade `IdempotencyKey` fields.
- Add PackPrize catalog snapshot fields.
- Add PackImportJob/Row state machine.
- Add creative tables/enums.
- Add VendorBanner lineage fields.
- Add storage abstraction with local + R2/S3 adapters.
- Add migration tests and fixtures.

### Phase 2 — CSV import/match/review

- Add `multer`, `csv-parse`, `@types/multer`.
- Add `/v1/vendor/pack-imports` endpoints.
- Add `pack-import-jobs` worker.
- Implement source file storage, streaming parse, batched CatalogItem matching.
- Implement paginated row review and optimistic resolution.
- UI: CSV upload + row review.

### Phase 3 — commit to DRAFT pack

- Implement idempotent guarded `commit-pack`.
- Transactionally create DRAFT Pack + PackPrize snapshots.
- Validate pack invariants.
- UI: created pack preview and “Generate Image” entry point.

### Phase 4 — deterministic compositor first

- Add `sharp` and template registry.
- Implement mock/static backgrounds.
- Fetch/cache exact CatalogItem images safely.
- Generate final draft + thumb with deterministic overlay.
- Golden-image tests.

### Phase 5 — creative job skeleton/mock provider

- Add `/v1/vendor/creative/*` endpoints.
- Add creative queue/worker, state machines, quota reservation, partial success.
- UI: template picker, safe brief input, generate 1-3 mock candidates, polling gallery.

### Phase 6 — real provider + production storage

- Add provider adapters and actual R2/S3 storage.
- Enable background-only image generation.
- Store provider usage/cost/moderation metadata.
- Enforce prompt/copy policy and quotas.

### Phase 7 — publish adapter

- Publish selected candidate by copying private draft to immutable public key.
- Create/update VendorBanner with lineage fields.
- Existing storefront `/v1/banners` remains unchanged.

## Required test matrix

CSV/import:

```text
CSV with BOM
quoted commas
multiline fields
duplicate headers
giant field
100k rows / over cap
formula injection =HYPERLINK(...)
HTML/script in card_name
duplicate card rows
ambiguous names
inactive CatalogItem
wrong game/language
CatalogItem missing image/provenance
paginated review
resolution stale rowVersion
commit called twice concurrently
commit after worker retry
cross-vendor import read/resolve/commit attempts
```

Creative/assets:

```text
creative job with one failed variant
cross-vendor packId creative attempt
cross-vendor asset publish attempt
prompt with protected franchise/artist/style tokens
copy with odds/scarcity/value/official claims
external image private-IP redirect
external image timeout/oversize/wrong MIME
provider timeout/moderation rejection
R2/S3 upload failure after provider success
worker retry after provider success
publish same asset twice
delete published asset attempt
immutable public key/cache behavior
```

## Final greenlight criteria

This is implementable when:

- Legal/product confirms promotional card-image policy or chooses no-card banner mode.
- `PackPrize` has catalog snapshot identity.
- Import and creative state machines are explicit and enforced.
- Commit/publish are idempotent and race-safe.
- Draft assets private; public published assets immutable.
- Prompt boundary excludes all card/IP names from provider prompts.
- Copy claim validator is tied to real pack state.
- Worker retry/quota behavior is defined.
- Compositor golden tests prove exact card identity and readable text.

## Residual risks after this plan

- Provider cost/latency variance and occasional moderation false positives.
- Catalog incompleteness causing review friction.
- Legal interpretation may vary by card game/source/jurisdiction.
- Generated abstract backgrounds may still need human curation for taste.
- Vendor CSV quality may be poor; review UX must be good enough to absorb ambiguity.

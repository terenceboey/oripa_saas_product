# Campaign Banner CSV → Pack → Creative — Final Oracle-Reconciled Architecture v3

## Bottom line

Build this as a **two-stage, pack-anchored pipeline**:

```text
CSV row
→ resolved source-backed CatalogItem
→ frozen PackPrize catalog snapshot
→ creative-input hash/version for rendered truth
→ creative job items sourced only from PackPrize
→ private draft candidate assets
→ publish-time live eligibility/legal/claim revalidation
→ immutable public VendorBanner asset
```

This satisfies the boss flow while closing the main failure modes:

```text
Vendor uploads CSV with card names/items
→ System generates pack contents from source-backed catalog matches
→ Vendor clicks/prompts Generate Image
→ System returns 1-3 generated banner candidates based on safe brief + exact frozen pack contents
```

Critical interpretation: AI generates **abstract background/style variants only**. Oripa overlays exact card images and text deterministically. No AI-redrawn cards, logos, characters, card text, or full-banner layout.

## Greenlight status

Pipeline shape is sound after two Oracle passes. The remaining implementation work is about enforcing invariants, not redesigning the architecture.

Do **not** greenlight coding until Phase 0 gates are decided and DB/API contracts below are accepted.

## Repo evidence inspected

- `apps/api/src/modules/banners/router.ts`: existing `VendorBanner` CRUD/display target.
- `apps/api/src/modules/catalog/router.ts`: source-backed `CatalogItem` search/matching source.
- `apps/api/src/modules/packs/router.ts`: existing pack creation semantics to reuse.
- `packages/shared/src/index.ts`: `createPackSchema`, `createBannerSchema` exist.
- `prisma/schema.prisma`:
  - `Pack.status` already supports `DRAFT`.
  - `PackPrize` lacks catalog identity/snapshot fields.
  - `IdempotencyKey` exists but lacks request-hash/status/resource semantics.
- `apps/api/src/queue.ts`: only `draw-jobs` exists.
- `apps/worker/src/index.ts`: placeholder draw worker only.
- `apps/web/app/vendor/page.tsx`: monolithic vendor UI seam.
- No CSV parser/upload infrastructure found.

Oracle artifacts:

- v1: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T145719Z_campaign-banner-csv-creative-architecture-v1/oracle_response.md`
- v2: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T150746Z_campaign-banner-csv-creative-architecture-v2/oracle_response.md`

## Phase 0 hard gates

1. **Legal/card-image policy**
   - Decide whether exact TCG card images can be used in promotional banners.
   - If not, MVP becomes abstract/no-card banners or vendor-uploaded licensed art.
   - Model eligibility per game/source/jurisdiction/image provenance, not just global yes/no.

2. **Pack/content lifecycle policy**
   - Define creative-eligible pack statuses and publish-eligible pack statuses.
   - Recommended:
     - Generate allowed from `DRAFT` or `ACTIVE` packs owned by vendor.
     - Publish allowed only if pack is `ACTIVE`, `isActive=true`, not deleted, buyable, has positive available stock/valid schedule, and storefront URL is valid.
   - Publishing a banner for an unbuyable/draft/deleted pack is blocked.

3. **Pack creation/economics contract**
   - Lock exact row-to-prize, stock, weight, totalStock, price/currency, schedule, draw limit behavior.
   - No hidden defaults for economics.

4. **Storage/security/provider gates**
   - Production storage must support private draft assets, signed previews, immutable public assets.
   - Verify real provider/model access, moderation policy, latency/cost.

## Non-goals

- No auto-publish.
- No arbitrary external target URLs.
- No campaign coupons/analytics/A-B tests/odds claims in MVP.
- No competitor screenshots/reference prompting.
- No production migration/write without explicit approval.

## Required DB contracts

### 1. Idempotency with request-hash semantics

Existing `IdempotencyKey.scopeKey` must be deterministically namespaced:

```text
{vendorId}:{operation}:{logicalTarget}:{clientKey}
```

Examples:

```text
vendor_1:pack-import-commit:import_123:key_abc
vendor_1:creative-create:pack_456:key_abc
vendor_1:creative-publish:asset_789:key_abc
```

Rules:

- Same scope key + same request hash → return stored response or in-progress status.
- Same scope key + different request hash → `409 Conflict`.
- Store `IN_PROGRESS | SUCCEEDED | FAILED`, response JSON, created resource type/id, expiry.

Recommended additive fields:

```prisma
requestHash         String?
status              String?  // IN_PROGRESS | SUCCEEDED | FAILED
createdResourceType String?
createdResourceId   String?
expiresAt           DateTime?
```

### 2. PackPrize catalog snapshot is mandatory for source-backed imported prizes

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

- Imported source-backed prizes require `catalogItemId`, `catalogSnapshotJson`, `catalogSnapshotHash`.
- Manual/legacy prizes can remain nullable but are not card-overlay eligible unless separately reviewed/licensed.
- Creative job visible items are sourced by `packPrizeId`, not naked `catalogItemId`.

### 3. Split rendered creative hash from live publish eligibility

Do **not** hash mutable stock/status fields into the rendered creative hash. Oracle v3 caught this: generating from `DRAFT` then publishing as `ACTIVE`, or normal sales changing `remainingStock`, must not force needless regeneration unless the rendered claim/image changed.

Add creative-input hash fields:

```prisma
model CampaignCreativeJob {
  packId                    String
  creativeInputHashAtCreate String
  packStatusAtCreate        String
  packUrlPathAtCreate       String?
  copyClaimFactsHashAtCreate String?
  // ...
}
```

`creativeInputHashAtCreate` includes only fields that affect rendered creative truth:

```text
pack.id
pack.vendorId
pack.title if rendered
selected PackPrize ids
PackPrize catalogSnapshotHash values
displayed labels/images
rendered price/value fields only if shown
template version
prompt template version
compositor version
```

Publish-time live checks are separate from hash equality:

```text
pack ACTIVE/isActive/not deleted
pack buyable
stock > 0 if banner implies availability
schedule valid
storefront URL valid
legal/image eligibility still valid
copy claims still valid against current state
```

Dynamic claims like “only 3 left”, “limited time”, value claims, and odds claims are blocked in MVP unless backed by `copyClaimFactsHashAtCreate` plus publish-time revalidation. If facts changed, block publish or require claim refresh/regeneration.

### 4. Pack import models

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
  rawCardName           String? // nullable so invalid missing card_name rows are representable
  normalizedCardName    String? // nullable for invalid rows

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

Statuses:

```text
PackImportJob: QUEUED → PARSING → MATCHING → NEEDS_REVIEW → READY_TO_COMMIT → COMMITTING → COMMITTED
                                             ↘ FAILED / CANCELLED / EXPIRED
PackImportRow: PENDING | INVALID | AUTO_MATCHED | AMBIGUOUS | MANUALLY_RESOLVED | UNMATCHED | SKIPPED | COMMITTED
```

### 5. Creative models are pack-required for MVP

Make pack anchoring explicit for MVP. No naked-catalog creative generation.

```prisma
model CampaignCreativeJob {
  id                     String @id @default(cuid())
  vendorId               String
  requestedById          String
  packId                 String  // required in MVP
  importJobId            String?

  status                 CampaignCreativeJobStatus @default(QUEUED)
  variantCount           Int @default(1)

  creativeInputHashAtCreate String
  packStatusAtCreate      String

  templateKey            String
  templateVersion        Int
  promptTemplateKey      String
  promptTemplateVersion  Int

  briefRaw               String?
  briefTokens            Json?
  copyClaimsJson         Json?
  copyPolicyStatus       String?

  quotaReservationId     String?
  idempotencyScopeKey    String?
  selectionPolicy        String?

  errorCode              String?
  errorMessage           String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  items                  CampaignCreativeJobItem[]
  assets                 CampaignCreativeAsset[]

  @@index([vendorId, status, createdAt])
}

model CampaignCreativeJobItem {
  id                  String @id @default(cuid())
  jobId               String
  packPrizeId         String  // required for visible items in MVP
  catalogItemId       String?
  catalogSnapshotJson Json
  catalogSnapshotHash String
  imageStorageKey     String?
  legalEligibilityJson Json?
  role                String // hero | supporting | hidden_context

  @@index([jobId])
  @@index([packPrizeId])
}

model CampaignCreativeAsset {
  id                     String @id @default(cuid())
  jobId                  String
  vendorId               String
  variantIndex           Int
  status                 CampaignCreativeAssetStatus @default(EXPECTED)

  backgroundStorageKey   String?
  draftStorageKey        String?
  thumbStorageKey        String?
  publishedStorageKey    String?

  width                  Int?
  height                 Int?
  mimeType               String?
  byteSize               Int?
  contentHash            String?
  etag                   String?

  provider               String?
  providerModel          String?
  providerRequestId      String?
  providerUsageJson      Json?
  providerCostCents      Int?
  providerLatencyMs      Int?
  materializedPromptHash String?
  moderationJson         Json?
  postGenInspectionJson  Json?

  sourceVendorBannerId   String?
  publishedAt            DateTime?
  errorCode              String?
  errorMessage           String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

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
EXPECTED | GENERATING_BACKGROUND | INSPECTING_BACKGROUND | COMPOSITING | READY_FOR_REVIEW | APPROVED | PUBLISHING | PUBLISHED | FAILED | DELETED | EXPIRED
```

### 6. VendorBanner lineage

```prisma
model VendorBanner {
  // existing fields...
  sourceCreativeAssetId String?
  sourceCreativeJobId   String?
  sourcePackId          String?
  imageStorageKey       String?
  imageContentHash      String?
}
```

## API contract

### Pack imports

```text
POST   /v1/vendor/pack-imports                  multipart upload; returns 202 { importId }
GET    /v1/vendor/pack-imports/:id              summary only
GET    /v1/vendor/pack-imports/:id/rows         paginated rows by status/cursor
PATCH  /v1/vendor/pack-imports/:id/resolutions optimistic rowVersion update
POST   /v1/vendor/pack-imports/:id/commit-pack  idempotent transactional commit
```

Upload caps must be concrete before implementation. Starting MVP defaults:

```text
max file size: 2 MB
max rows: min(vendorSettings.maxPackItems, 500) for MVP
max columns: 32
max field length: 512 chars
max card_name length: 200 chars
parse timeout: 30s
allowed encodings: UTF-8 with optional BOM
unknown columns: ignored but reported
formula-like cells: stored escaped and flagged; never executed/exported raw
```

CSV minimum:

```csv
card_name
Pikachu
Charizard
```

Production recommended:

```csv
card_name,game,language,set_name,card_number,variant,condition,tier,stock,weight,estimated_value_cents
Pikachu,POKEMON,en,Base Set,58/102,normal,near_mint,A Tier,1,10,10000
```

Auto-match rule:

```text
Auto-match only if strong identity fields exist AND canonical lookup resolves exactly one active CatalogItem AND item/image legal/provenance checks pass.
Card-name-only rows default to NEEDS_REVIEW/AMBIGUOUS, not blind auto-match.
```

### Creative jobs

```text
GET    /v1/vendor/creative/templates
POST   /v1/vendor/creative/jobs
GET    /v1/vendor/creative/jobs/:id
GET    /v1/vendor/creative/jobs/:id/assets
POST   /v1/vendor/creative/assets/:assetId/publish-banner
DELETE /v1/vendor/creative/assets/:assetId
```

Create request:

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

- `packId` required in MVP.
- `highlightPackPrizeIds` required or server derives from pack prize tier/value/rarity policy.
- All highlighted prizes must belong to pack/vendor, have snapshots, be legal-eligible, and have safe images.
- Server derives target URL from pack route; no arbitrary external URL.
- Generate allowed from DRAFT/ACTIVE; publish only ACTIVE/buyable.

### Publish transition

Publish uses conditional update/state machine:

```text
READY_FOR_REVIEW/APPROVED → PUBLISHING → PUBLISHED
```

Publish preconditions:

- asset belongs to vendor;
- asset not deleted/expired/failed;
- job belongs to vendor;
- pack still publish-eligible;
- current rendered creative inputs still match `creativeInputHashAtCreate`, or vendor regenerates/refreshes;
- legal policy still permits every displayed image;
- copy claims still valid against current pack state;
- idempotency request hash matches or new key.

Publish action:

- copy private draft to `public/vendors/{vendorId}/banners/{bannerId}/{sha256}.webp`;
- create/update `VendorBanner` lineage;
- public key is immutable; retries reuse same published key by content hash.

Delete rules:

- draft/ready asset: soft delete allowed;
- published asset: cannot delete while VendorBanner references it;
- removing storefront banner uses existing banner management flow.

## Matching and pack generation

Row-to-prize MVP:

- One valid matched row → one PackPrize.
- Duplicate catalog items aggregate only if stock/weight/tier/value metadata match; otherwise preserve distinct rows.
- `stock` default: 1.
- `weight`: vendor must choose explicit policy (`equal`, `tier_preset`, or CSV-provided). Do not silently invent odds if product rejects equal odds.
- `estimatedValueCents`: nullable if unknown; never default to 0.
- Commit creates DRAFT pack only.
- Pack commit reuses `createPackSchema` semantics and existing pack invariant checks.

## Prompt/copy/rendering safety

### Provider prompt boundary

No card names, franchise names, set names, character names, logos, artist names, or card text in provider prompt — not even in negative prompt.

Allowed style tokens:

```text
premium_foil
neon_arcade
minimal_luxury
sports_card_showcase
dark_chrome
festive_drop
```

Block/remap:

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

### Post-generation inspection

Prompt boundary is not sufficient. Before `READY_FOR_REVIEW`, inspect background for:

- readable text/logo-like marks;
- character/franchise-looking elements;
- policy/moderation flags;
- unsafe or off-brand content.

Fail or regenerate variant if inspection fails, subject to quota/billing policy.

### Copy claims validator

Block or require proof for:

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

Validate title/subtitle/CTA/brief against pack state:

- scarcity requires real inventory/schedule;
- value claim requires pricing source;
- odds claim requires odds/disclosure approval;
- official/endorsement/licensed claims blocked unless verified.

### SVG/sharp text safety

Before rendering vendor text into SVG:

- length-limit and line-wrap;
- XML-escape all text;
- forbid raw SVG/HTML/markup input;
- do not allow external SVG refs, `foreignObject`, scripts, remote fonts, or untrusted font URLs;
- use packaged fonts only;
- cap image dimensions and rendering time.

## Storage and image safety

Private draft/public published split:

```text
private/vendors/{vendorId}/pack-imports/{importId}/{sha256}.csv
private/vendors/{vendorId}/catalog-cache/{catalogItemId}/{sha256}.webp
private/vendors/{vendorId}/creative/{jobId}/variant-{n}/{sha256}-draft.webp
private/vendors/{vendorId}/creative/{jobId}/variant-{n}/{sha256}-thumb.webp
public/vendors/{vendorId}/banners/{bannerId}/{sha256}.webp
```

External catalog image fetching, if unavoidable:

- HTTPS only;
- host allowlist;
- no private IPs/localhost/link-local;
- max bytes/dimensions;
- content-type sniffing;
- redirect cap;
- download/decode timeouts;
- cache into Oripa-controlled storage before compositor reads.

## Queue/retry/quota

Queues:

```text
pack-import-jobs
campaign-creative-jobs
creative-variant-jobs optional
asset-cleanup-jobs optional
```

BullMQ defaults to set explicitly:

```ts
attempts: 3,
backoff: { type: 'exponential', delay: 10_000 },
removeOnComplete: { age: 86400 },
removeOnFail: false,
concurrency: small bounded number,
lockDuration: tuned above max provider/compositor time,
limiter: vendor/global provider cap,
jobId: deterministic id,
```

Quota rules:

- Reserve quota/cost at creative job creation.
- Per-vendor concurrent creative jobs: 1 in MVP.
- Global provider concurrency cap.
- Release/adjust reservation on terminal failure/partial success.
- If crash happens after provider success but before metadata persistence, double billing remains possible unless provider idempotency exists; cap budget and alert on suspicious retry/provider-call mismatch.

## Implementation sequence

### Phase 0 — gates and contracts

- Legal card image promotional-use decision.
- Pack lifecycle publish/generate matrix.
- Row-to-prize/economics contract.
- Provider/model/storage decision.
- Concrete upload/render/provider caps.

### Phase 1 — schema/idempotency/storage foundation

- Upgrade idempotency semantics.
- Add PackPrize snapshot fields.
- Add PackImportJob/Row.
- Add CreativeJob/Item/Asset.
- Add VendorBanner lineage.
- Add storage abstraction local + R2/S3.
- Migration tests and fixtures.

### Phase 2 — CSV import/match/review

- Add `multer`, `csv-parse`, `@types/multer`.
- Upload endpoint stores raw file and queues parse.
- Worker parses streaming CSV with caps.
- Batched CatalogItem matching.
- Paginated row review and optimistic resolution UI.

### Phase 3 — commit DRAFT pack

- Guarded idempotent commit.
- Transaction creates DRAFT Pack + PackPrize snapshots.
- Creative job has creative-input hash support.
- UI shows pack contents and Generate Image entry point.

### Phase 4 — deterministic compositor with mock backgrounds

- Add `sharp` template registry.
- Safe SVG/text renderer.
- Card image cache/fetcher.
- Golden-image tests.

### Phase 5 — creative job skeleton/mock provider

- Creative APIs.
- Queues/state machines/quota.
- 1-3 candidate gallery with private draft assets.
- Publish disabled or mock-only.

### Phase 6 — real provider + production storage

- Provider adapter(s).
- Background-only generation.
- Post-generation inspection.
- Usage/cost/moderation metadata.

### Phase 7 — publish adapter

- Revalidate pack content hash/status/legal/copy.
- Copy private draft to immutable public key.
- Create/update VendorBanner with lineage.
- Existing `/v1/banners` storefront contract unchanged.

## Test matrix

CSV/import:

```text
BOM
quoted commas
multiline fields
duplicate headers
giant fields
over-row cap
over-byte cap
formula injection
HTML/script card_name
missing card_name invalid row persistence
duplicate card rows
ambiguous names
inactive CatalogItem
wrong game/language
missing image/provenance
paginated review
stale rowVersion resolution
concurrent commit double-click
worker retry after DB write
cross-vendor read/resolve/commit
```

Creative/publish:

```text
generate from DRAFT allowed but publish blocked
generate from ACTIVE and publish allowed
pack creative inputs changed before publish → blocked/refresh required
pack disabled/sold-out/expired before publish → blocked
highlightPackPrizeId from another vendor → blocked
manual prize without catalog snapshot → not eligible
one of three variants fails → partial success
prompt protected tokens blocked/remapped
copy claims blocked without backing state
SVG/XML injection escaped
foreignObject/external SVG refs rejected
post-gen text/logo inspection failure
external image private-IP redirect
provider timeout/moderation rejection
R2 upload failure after provider success
worker retry after provider success
publish same asset twice idempotent
publish while asset soft-deleted/expired blocked
delete published asset blocked while banner references it
public key immutable/cache-safe
```

## Final acceptance criteria

The plan is complete when engineering can implement these invariants:

- Every displayed generated card came from a frozen `PackPrize` catalog snapshot.
- Every creative job has a creative-input hash and publish separately revalidates live eligibility.
- No image provider prompt contains protected card/IP identity.
- Draft assets are private; published assets are immutable public copies.
- Commit and publish are idempotent/race-safe.
- Legal/image eligibility is checked per displayed item.
- Copy claims are validated against live pack state.
- Renderer cannot be abused via SVG/text injection.
- Worker retries do not silently mutate state or duplicate storefront banners.

## Residual risks after implementation

- Provider cost/latency variance and possible double billing on crash windows without provider idempotency.
- Moderation false positives/false negatives for abstract backgrounds.
- Catalog incompleteness and messy vendor CSVs causing high review burden.
- Legal interpretation changing by card game/source/jurisdiction.
- Taste/brand quality still needs human curation.

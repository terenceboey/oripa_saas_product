# Campaign Banner CSV → Pack → Creative Architecture — Oracle Input

## User/boss flow

```text
Vendor uploads CSV containing items/card names
→ System generates pack contents from those items
→ Vendor prompts/clicks "Generate Image"
→ System returns vendor 1-3 generated images based on prompt + contents inside
```

## Done definition for this plan

- Covers existing Oripa repo seams and current constraints.
- Converts boss flow into implementable phases with DB/API/worker/UI/storage details.
- Keeps collectible card identity exact; AI does not redraw card faces/text/logos.
- Defines CSV import/matching/ambiguity flow and generated pack creation.
- Defines creative job flow returning 1-3 candidate banners.
- Includes safety/legal/cost/quota/observability gates.
- Reconciled with Oracle until no practical architecture gaps remain or residual blockers are explicit.

## Repo evidence inspected

- Existing banner CRUD/display:
  - `apps/api/src/modules/banners/router.ts`
  - `packages/shared/src/index.ts:createBannerSchema`
  - `prisma/schema.prisma:VendorBanner`
- Existing catalog search:
  - `apps/api/src/modules/catalog/router.ts`
  - current search returns exact CatalogItem image/provenance fields but has known perf work pending.
- Existing pack creation:
  - `apps/api/src/modules/packs/router.ts`
  - `packages/shared/src/index.ts:createPackSchema`
  - `prisma/schema.prisma:Pack`, `PackPrize`
- Existing worker/queue:
  - `apps/api/src/queue.ts` only `draw-jobs`
  - `apps/worker/src/index.ts` placeholder `draw-jobs` worker
- Existing vendor UI:
  - `apps/web/app/vendor/page.tsx` monolithic client page, existing `CatalogSuggestion` type and catalog search behavior.
- Prior reconciled plans:
  - `docs/plans/campaign-creative-generator-plan.md`
  - `docs/plans/campaign-creative-generator-oracle-review.md`
  - `docs/plans/campaign-creative-reference-capture-oracle-reconciled.md`
- No CSV upload/parser infra found:
  - no `multer`, `busboy`, `formidable`, `papaparse`, `csv-parse`, or `fast-csv` usage.

## External research summary

- OpenAI image docs were consulted via web extraction, but platform pages are partially Cloudflare-rendered/truncated. Treat exact model availability as a live integration gate, not a planning assumption.
- Sharp docs: high-performance Node image processing; supports resize/composite and web-friendly outputs; suitable for deterministic banner compositor.
- BullMQ docs: Redis-backed queue with retries, concurrency, delayed jobs, crash recovery; already used by repo.
- Cloudflare R2 docs: S3-compatible object storage, public buckets, bucket-scoped tokens, CORS, no egress-fee positioning; suitable for generated public banner assets.
- AWS S3 docs: high request rates; 3,500 writes/s and 5,500 reads/s per prefix baseline; prefix strategy is enough for vendor/job object keys.
- CSV parser research: Node CSV parser options include `csv-parse`, Papa Parse, fast-csv. For API/server import, prefer `csv-parse` streaming; for pure browser preview, Papa Parse is acceptable but server remains authoritative.

## Core architectural decision

Build two connected subsystems:

```text
Pack CSV Import
  CSV upload/text paste
  → parse/validate rows
  → resolve card names to CatalogItem
  → ambiguity review
  → create Pack + PackPrize rows in DRAFT
  → expose exact source-backed contents for creative generation

Campaign Creative Generator
  Pack contents / selected prize rows
  + vendor safe creative brief
  + controlled template/style
  → async generation of 1-3 abstract backgrounds
  → deterministic compositor overlays exact card images + title/CTA
  → asset review gallery
  → explicit publish-to-VendorBanner adapter
```

Critical: the user's phrase “based on the prompt + contents inside” should not mean raw prompt directly controls full-banner image generation. It should mean vendor-provided brief/style fields are normalized into server-owned prompts, and pack contents choose exact cards composited after AI background generation.

## Non-goals

- No AI-redrawn card faces, card text, official logos, or characters.
- No auto-publish to storefront.
- No campaign mechanics, discounts, odds claims, coupon rules, analytics, or A/B testing in MVP.
- No competitor screenshots/assets as prompt inputs or templates.
- No direct production live DB writes/migrations without explicit approval.
- No replacing `VendorBanner` display contract.

## CSV import architecture

### MVP CSV shape

Recommended required columns:

```csv
card_name,game,language,set_name,card_number,tier,stock,weight,estimated_value
Pikachu,POKEMON,en,Base Set,58/102,A Tier,1,10,100
```

Minimum acceptable for boss demo:

```csv
card_name
Pikachu
Charizard
```

But card-name-only CSV must go to review because names are ambiguous across sets/languages.

### API shape

Prefer multipart upload for real CSV; allow text body only for tiny MVP/dev.

```text
POST   /v1/vendor/pack-imports
GET    /v1/vendor/pack-imports/:id
PATCH  /v1/vendor/pack-imports/:id/resolutions
POST   /v1/vendor/pack-imports/:id/commit-pack
```

`POST /pack-imports`:
- OWNER/MANAGER only.
- Accepts file + pack metadata: title, pricePoints, totalStock, startsAt, endsAt, draw limit fields.
- Stores import job and raw file/storage key or normalized row JSON.
- Enqueues `pack-import-jobs` BullMQ job.
- Returns `202 { importId }`.

`GET /pack-imports/:id`:
- Vendor-scoped read.
- Returns parse status, row counts, matched rows, ambiguous rows, unmatched rows, errors.

`PATCH /resolutions`:
- Vendor selects `catalogItemId` per ambiguous row or skips row.
- Server revalidates selected CatalogItem is active and compatible with game/language/itemType.

`POST /commit-pack`:
- Idempotent via `x-idempotency-key` plus import ID status.
- Creates DRAFT Pack + PackPrize rows in a transaction.
- Returns `packId` and optional `creativeSeed` containing candidate highlighted items.

### Data model

```prisma
model PackImportJob {
  id              String @id @default(cuid())
  vendorId        String
  requestedById   String
  status          PackImportStatus @default(QUEUED)
  originalFileName String?
  fileStorageKey  String?
  inputHash       String?
  packDraftJson   Json
  rowCount        Int @default(0)
  matchedCount    Int @default(0)
  ambiguousCount  Int @default(0)
  unmatchedCount  Int @default(0)
  errorCode       String?
  errorMessage    String?
  createdPackId   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  rows            PackImportRow[]

  @@index([vendorId, status, createdAt])
}

model PackImportRow {
  id                   String @id @default(cuid())
  importJobId           String
  rowIndex              Int
  rawCardName           String
  normalizedCardName    String
  game                  String?
  language              String?
  setName               String?
  cardNumber            String?
  tier                  String?
  stock                 Int?
  weight                Int?
  estimatedValue        Int?
  status                PackImportRowStatus @default(PENDING)
  matchedCatalogItemId  String?
  suggestionsJson       Json?
  errorMessage          String?

  @@unique([importJobId, rowIndex])
  @@index([importJobId, status])
  @@index([matchedCatalogItemId])
}
```

Why row table instead of one big JSON blob:
- Easier review pagination.
- Easier update of individual ambiguous rows.
- Avoids giant JSON payloads for larger CSV.
- Better audit/debug for vendor disputes.

### Matching algorithm

For each CSV row:
1. Normalize name: trim, lowercase, collapse whitespace, normalize punctuation and Unicode.
2. Apply game/language default from CSV/import form/vendor preference.
3. If set/card number present, exact match on `(game, language, name, setName/cardNumber)`.
4. Else exact lower(name) match.
5. If exactly one high-confidence result: auto-match.
6. If multiple or lower confidence: store top suggestions and status `AMBIGUOUS`.
7. If zero: status `UNMATCHED`.

Important: popular names like `Pikachu`, `Charizard`, `Energy`, `Luffy`, etc. will be ambiguous. Card-name-only upload cannot safely auto-create exact contents without a review step.

### Pack generation

Commit transforms matched rows to existing pack schema:
- `Pack.title`, `pricePoints`, `totalStock`, schedule/status from import form.
- `PackPrize.label = CatalogItem.name` plus optional set/card suffix for clarity.
- `PackPrize.imageUrl = imageLargeUrl ?? imageBaseUrl ?? imageThumbUrl ?? fallback`.
- `stock = CSV stock ?? 1`.
- `weight = CSV weight ?? equal distribution`.
- `estimatedValue = CSV estimated_value ?? 0` until pricing source exists.

Recommended schema improvement:

```prisma
model PackPrize {
  catalogItemId String?
  catalogSource String?
  catalogSourceItemId String?
  catalogSnapshotJson Json?
}
```

This is important because the creative generator should know which exact source-backed CatalogItem each prize came from. Otherwise it has to reverse-search `PackPrize.label` later.

## Creative generator architecture for boss flow

### API shape

```text
GET    /v1/vendor/creative/templates
POST   /v1/vendor/creative/jobs
GET    /v1/vendor/creative/jobs/:id
GET    /v1/vendor/creative/jobs/:id/assets
POST   /v1/vendor/creative/assets/:assetId/publish-banner
DELETE /v1/vendor/creative/assets/:assetId
```

`POST /creative/jobs` accepts:

```json
{
  "packId": "...",
  "source": "pack_import|pack|manual",
  "templateKey": "premium_drop_split_hero",
  "variantCount": 3,
  "brief": "shiny premium anime-style collector drop",
  "title": "Weekend Chase Drop",
  "subtitle": "Top hits inside",
  "cta": "View packs",
  "targetUrl": "https://vendor.example/pack/...",
  "highlightCatalogItemIds": ["..."]
}
```

Rules:
- `variantCount`: 1-3.
- `brief`: not a raw prompt; sanitize and classify into allowed style tokens. Store raw brief for audit but do not inject it as instructions.
- `highlightCatalogItemIds`: must belong to PackPrize catalog snapshots or be selected from same vendor pack context.
- If omitted, auto-pick top 1-3 by CSV tier/estimated value/rarity.

### Data model

Reuse/extend prior plan tables:
- `CampaignCreativeTemplate`
- `CampaignCreativeJob`
- `CampaignCreativeJobItem`
- `CampaignCreativeAsset`

Add fields for boss flow:

```prisma
CampaignCreativeJob.packId String?
CampaignCreativeJob.importJobId String?
CampaignCreativeJob.variantCount Int @default(1)
CampaignCreativeJob.briefRaw String?
CampaignCreativeJob.briefTokens Json?
CampaignCreativeJob.selectionPolicy String? // vendor_selected | top_value | tier_first

CampaignCreativeAsset.variantIndex Int
CampaignCreativeAsset.backgroundStorageKey String?
CampaignCreativeAsset.reviewStatus CampaignCreativeAssetStatus @default(DRAFT)
```

### Generation pipeline

```text
Vendor clicks Generate Image
→ API validates pack/vendor/role/quota/template/variantCount
→ creates CampaignCreativeJob(QUEUED) and N expected variants
→ BullMQ worker processes variants concurrently with low cap
→ for each variant:
   1. load template + pack contents + selected CatalogItem snapshots
   2. convert brief to safe style tokens
   3. render server-owned background prompt
   4. call image provider for abstract background only
   5. fetch exact CatalogItem card images server-side
   6. deterministic sharp compositor overlays cards/text/CTA/layout
   7. upload background/final/thumb assets to object storage
   8. save asset metadata and status
→ API polling returns 1-3 final candidate image URLs
→ vendor approves/publishes selected asset to VendorBanner
```

### Provider strategy

Use provider abstraction, not hardwire the app to one model.

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
    seed?: number;
    costCents?: number;
    rawMetadata?: unknown;
  }>;
}
```

Recommended provider order:
1. OpenAI official image API if org/model access is verified and policy fit is acceptable.
2. FAL/Flux provider as fallback or alternate if product wants faster cheaper creative backgrounds.
3. Mock/static provider for tests/dev.

Do not let vendor choose provider/model directly in MVP.

### Why not full-banner AI output

Full-banner generation is worse because:
- card faces/text/logos get distorted;
- generated text/CTA is unreliable;
- official IP/logo hallucinations create legal risk;
- final layout/crops become non-deterministic;
- vendor cannot trust the banner corresponds to actual pack contents.

Correct interpretation: AI generates atmospheric background variants. Oripa deterministically renders the pack contents into the image.

## Storage/CDN

Add `AssetStorage` abstraction:
- local filesystem adapter for dev/tests;
- Cloudflare R2/S3 adapter for production;
- public CDN URL only for published/final banner assets;
- signed preview URLs for draft assets if bucket is private.

Key scheme:

```text
vendors/{vendorId}/pack-imports/{importId}/source.csv
vendors/{vendorId}/creative/{jobId}/variant-{n}/background.webp
vendors/{vendorId}/creative/{jobId}/variant-{n}/final.webp
vendors/{vendorId}/creative/{jobId}/variant-{n}/thumb.webp
```

## Security / safety / compliance

- RBAC: generate/import/commit/publish OWNER/MANAGER in MVP; STAFF read-only if needed.
- Vendor isolation on every query and storage key.
- File caps: size, row count, extension/MIME sniffing, parse timeout.
- CSV injection: escape display/export values; never eval; never execute formulas.
- Prompt injection: vendor brief/card names are data; prompt is rendered by server template only.
- Copy safety: block odds, guaranteed winnings, official endorsement, false scarcity, discounts/coupons unless backed by product state.
- Legal/IP: exact TCG card images in promotional banners are a launch gate; avoid official logos/endorsement claims.
- Moderation: default/strict provider moderation; no relaxed mode.
- Quotas: per-vendor daily generation caps, max concurrent jobs 1, monthly budget alerts, variantCount max 3.
- Observability: structured logs with jobId/importId/vendorId/status/errorCode/providerRequestId; no raw secrets or full prompts with sensitive data.

## Triage / implementation phases

### Phase 0 — Gates and foundation

- Decide object storage: Cloudflare R2 recommended.
- Verify image provider access and model names in the actual deployment account.
- Confirm legal/product approval path for card imagery in promotional banners.
- Decide CSV required columns for boss demo vs production.

### Phase 1 — CSV import preview, no pack creation yet

- Add `csv-parse`, `multer`, `@types/multer`.
- Add `PackImportJob`/`PackImportRow` models.
- Add router `apps/api/src/modules/pack-imports/router.ts` and mount in `app.ts`.
- Add `pack-import-jobs` queue/worker.
- Implement parse/match/status endpoints.
- UI: upload CSV and show matched/ambiguous/unmatched rows.

Acceptance:
- CSV upload returns `importId`.
- Rows are parsed and matched to CatalogItem or marked ambiguous/unmatched.
- Vendor can resolve ambiguous rows.
- No Pack or Banner writes yet.

### Phase 2 — Commit imported rows to DRAFT Pack

- Add optional `catalogItemId`/snapshot fields to `PackPrize`.
- Implement idempotent `commit-pack` endpoint.
- Use transaction to create DRAFT Pack + PackPrize rows.
- UI shows created DRAFT pack and contents.

Acceptance:
- Commit creates a DRAFT pack from matched rows.
- Partial failures roll back.
- Repeated commit does not create duplicate pack.
- Existing pack display still works.

### Phase 3 — Creative skeleton/mock provider

- Add creative Prisma tables/enums.
- Add `creative` router endpoints.
- Add `campaign-creative-jobs` queue/worker with mock provider.
- Add storage abstraction local adapter.
- UI button: Generate Image for pack; polling; gallery shows 1-3 mock assets.

Acceptance:
- Vendor can request 1-3 candidates from a pack.
- Job status and assets are vendor-scoped.
- No external provider required.
- No `VendorBanner` mutation yet.

### Phase 4 — Deterministic compositor

- Add `sharp` and template layouts.
- Render final banner from static/test background + exact CatalogItem card images + title/CTA.
- Generate thumbnails.

Acceptance:
- Output dimensions exact.
- Cards are not passed to AI provider.
- Text is crisp/deterministic.
- Images respect safe zones/crops.

### Phase 5 — Real image provider + R2/S3

- Add OpenAI/FAL provider adapter behind interface.
- Add R2/S3 storage adapter.
- Store provider metadata/cost/error codes.
- Apply quotas and concurrency limits.

Acceptance:
- Real background variants generated.
- Final 1-3 candidate banners uploaded and reviewable.
- Failures mark job failed without pack/banner mutation.

### Phase 6 — Publish adapter

- Implement `publish-banner` to create/update `VendorBanner` from selected FINAL asset.
- Keep storefront `/v1/banners` unchanged.

Acceptance:
- Vendor publishes one generated candidate as banner.
- Existing banner carousel displays it.
- Cross-vendor publish attempts fail.

## Residual blockers / open decisions

1. Legal/product approval for promotional use of exact TCG card imagery.
2. Production storage choice and bucket/CDN policy.
3. Actual image provider/model access and pricing in the deployed account.
4. CSV schema strictness: boss-demo card-name-only vs production requiring game/set/card_number.
5. Catalog search performance work should land before batch matching large CSVs.
6. Whether `PackPrize.catalogItemId` migration is allowed now; strongly recommended before creative generation.

## Candidate final recommendation

Implement this as a Pack Import + Creative Generator pipeline, not as a direct CSV-to-AI-image shortcut. The generated images should be 1-3 deterministic final banners whose backgrounds are AI-generated and whose card contents/text are composed by Oripa from source-backed CatalogItem/PackPrize data.

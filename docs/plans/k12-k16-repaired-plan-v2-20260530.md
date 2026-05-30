# Oripa K12–K16 Repaired Implementation Plan v2

Generated: 2026-05-30
Repair loop status: **converged**. Oracle pass4 returned `CLEAN` with no material blockers after pass3 patches (facets/suggest contract, type/itemClass normalization, entity field normalization).

Source reviews:
- `docs/plans/k12-k16-oracle-pass2-review-20260530.md`
- `docs/plans/k12-k16-refined-local-review-20260530.md`

## Verdict / posture

This plan is implementation-ready only for the narrowed P0 source-backed catalog slice. It deliberately separates three seams:

1. **Source-backed catalog search**: `CARD`, `SEALED_PRODUCT`, `SET`.
2. **Vendor-owned inventory search**: slabs/custom/complete sets/physical stock; deferred and scoped separately.
3. **Prizeability/taxonomy**: labels/categories/prizeable objects; design-first, not a K12/K13 blocker.

## Evidence baseline

Live DB after K10/K11 cleanup:

```json
{
  "CatalogItem": 245844,
  "CatalogSet": 1272,
  "CatalogSealedProduct": 2963,
  "VendorInventoryItem": 0,
  "PackPrize": 9,
  "CatalogItemBySource": {
    "onepiecedb.io": 2488,
    "pokemoncard.io": 22451,
    "tcgtracking": 220905
  },
  "CatalogItemByType": { "CARD": 245844 }
}
```

Code evidence:

- `/v1/catalog/search`, `/suggest`, `/facets` currently search `CatalogItem` only.
- Current `type=sealed` maps to `CatalogItemType.SEALED_PRODUCT`, but no such live `CatalogItem` rows exist.
- Sealed products live in `CatalogSealedProduct`.
- Sets live in `CatalogSet`; `Canonical*` tables exist but population/maintenance is not proven for P0.
- `VendorInventoryItem` has slab primitive fields but no rows and no explicit inventory class.
- `PackPrize.label` and `PackTemplateSlot.label` are immutable/display labels, not taxonomy.

## Non-goals for P0

- No live DB writes.
- No schema migration.
- No vendor-owned inventory/slab/custom/accessory search.
- No raw cert display.
- No label/category filters.
- No cursor pagination.
- No migration to canonical search docs.
- No destructive source collapse or pruning.
- No name-only dedupe/collapse.
- No mutation of `PackPrize` snapshots.

## Source precedence policy

- TCGTracking is precedent/source-of-record for set/display imagery where overlapping.
- Bulbapedia is fallback/reference only.
- Card-native sources may remain preferred for card details only through explicit `game + itemClass + useCase + source` policy and tests.
- Source ranking is display/collapse policy only; it is not destructive cleanup approval.

---

# P0 implementation tickets

## K15.1 — Source rank registry before expanding search

**Objective:** Replace hardcoded source priority in `search-dedupe.ts` with explicit policy keyed by game, item class, source, and use case.

**Files:**

- Create: `apps/api/src/modules/catalog/source-priority.ts`
- Modify: `apps/api/src/modules/catalog/search-dedupe.ts`
- Test: `apps/api/src/modules/catalog/source-priority.spec.ts`
- Test: `apps/api/src/modules/catalog/search-dedupe.spec.ts`

**Types:**

```ts
export type CatalogItemClass =
  | 'CARD'
  | 'SEALED_PRODUCT'
  | 'SET'
  | 'SLAB'
  | 'CUSTOM_ITEM'
  | 'ACCESSORY'
  | 'BONUS';

export type SourceRankUseCase =
  | 'SEARCH_DISPLAY'
  | 'SET_IMAGERY'
  | 'CARD_DETAILS'
  | 'MERGE_CANONICAL';

export type SourceRankPolicy = {
  displayRank: number;
  collapseEligible: boolean;
};
```

**Implementation rules:**

- `getSourceRank({ game, itemClass, source, useCase })` returns policy.
- Unknown sources get low priority and `collapseEligible: false` unless stable-ID collapse already exists.
- `SET` + `SET_IMAGERY` / `SEARCH_DISPLAY`: TCGTracking ranks above Bulbapedia/fallback sources where overlapping.
- Existing Pokémon/One Piece card precedence can be preserved only as explicit `CARD_DETAILS`/`SEARCH_DISPLAY` policy and covered by tests.
- No name-only collapse.
- Collapse eligibility and display priority are separate concepts.

**Acceptance criteria:**

- `search-dedupe.ts` has no hardcoded source array/rank logic.
- Ranking varies by `game + itemClass + useCase + source`.
- TCGTracking can win for sets while card-native sources can still win for cards if configured.
- Rows without stable external ID or reviewed equivalence do not collapse.
- `sourcePayload` remains absent from API response DTOs.

**Verification:**

- Unit test: TCGTracking rank wins for `SET/SET_IMAGERY`.
- Unit test: Pokémon card rank is explicit and deterministic.
- Unit test: One Piece card rank is explicit and deterministic.
- Unit test: unknown source rank is low and not collapse-eligible.
- Unit test: no stable ID means no collapse, even if names match.
- API build passes.

## K12.1 — Typed source-backed search adapters

**Objective:** Route catalog search by source-backed class so cards, sealed products, and sets use the correct populated tables.

**Files:**

- Modify: `apps/api/src/modules/catalog/router.ts`
- Modify/Create: `apps/api/src/modules/catalog/search-query.ts`
- Create: `apps/api/src/modules/catalog/search-adapters.ts`
- Test: `apps/api/src/modules/catalog/search-adapters.spec.ts`
- Test/Modify: existing catalog router integration tests if present.

**P0 class routing:**

| itemClass | backing model | P0 behavior |
| --- | --- | --- |
| `CARD` | `CatalogItem` | existing card behavior preserved |
| `SEALED_PRODUCT` | `CatalogSealedProduct` | new adapter |
| `SET` | `CatalogSet` | new adapter |
| `SLAB` | none | deterministic empty/capability-gated |
| `CUSTOM_ITEM` | none | deterministic empty/capability-gated |
| `ACCESSORY` | none | deterministic empty/capability-gated |
| `BONUS` | none | deterministic empty/capability-gated |

**Query contract:**

- Preserve old `type=card|sealed|all` as compatibility alias.
- Add `itemClass=CARD|SEALED_PRODUCT|SET|SLAB|CUSTOM_ITEM|ACCESSORY|BONUS|ALL`.
- `type=sealed` must query `CatalogSealedProduct`, not `CatalogItem`.
- `q` min length 2 for new adapters unless current legacy behavior must be preserved for cards.
- `limit` max 30.
- Reject `offset`; cursor deferred.

**Query normalization:**

Introduce one normalized internal field:

```ts
type NormalizedCatalogSearchClass =
  | 'CARD'
  | 'SEALED_PRODUCT'
  | 'SET'
  | 'SLAB'
  | 'CUSTOM_ITEM'
  | 'ACCESSORY'
  | 'BONUS'
  | 'ALL';
```

Rules:

- `itemClass` is the canonical new parameter.
- `type` is a legacy alias only.
- If neither `type` nor `itemClass` is provided, default to `CARD` to preserve legacy behavior.
- If only `type` is provided: `card -> CARD`, `sealed -> SEALED_PRODUCT`, `all -> ALL`.
- If only `itemClass` is provided, use `itemClass`.
- If both are provided and equivalent, accept.
- If both are provided and conflicting, return `400 invalid_query` with message `type and itemClass conflict`.
- Adapter routing consumes only the normalized class, never raw `type`.

Verification additions:

- Test: no class params defaults to `CARD`.
- Test: `type=sealed` normalizes to `SEALED_PRODUCT`.
- Test: `itemClass=SET` normalizes to `SET` despite no explicit `type`.
- Test: `type=sealed&itemClass=SEALED_PRODUCT` succeeds.
- Test: `type=sealed&itemClass=CARD` returns `400 invalid_query`.

**Facets/suggest P0 contract:**

P0 expands only `/v1/catalog/search` to source-backed `CARD`, `SEALED_PRODUCT`, and `SET`. `/v1/catalog/facets` and `/v1/catalog/suggest` remain card-only in P0 unless a separate typed adapter ticket is pulled into scope.

Rules:

- `/facets` and `/suggest` must reject `itemClass=SEALED_PRODUCT`, `itemClass=SET`, `type=sealed`, and `type=all` with `400 unsupported_for_endpoint`, OR return explicit capability metadata showing `supportedItemClasses: ['CARD']`.
- They must not silently imply sealed/set coverage while querying only `CatalogItem`.
- API docs/tests must state these endpoints are card-only until K12.4 typed facets/suggest.

Verification additions:

- Test: `/v1/catalog/suggest?itemClass=SET&q=...` returns deterministic unsupported response, not card results.
- Test: `/v1/catalog/facets?type=sealed` returns deterministic unsupported response, not empty misleading card-table facets.
- Test: legacy `/suggest` and `/facets` with default card behavior still pass.

**Acceptance criteria:**

- Existing card search remains backward compatible.
- Sealed search returns `CatalogSealedProduct` rows.
- Set search returns `CatalogSet` rows.
- Reserved future classes return stable empty payload with capability metadata, not 500/404.
- No response includes `sourcePayload`.
- No response includes inventory/private fields.

**Verification:**

- Integration test seeded with one card, one sealed product, one set.
- Test proves `type=sealed` uses sealed adapter.
- Snapshot/DTO test forbids `sourcePayload`.
- Negative response-key test forbids `vendorId`, `inventoryItemId`, `customItemId`, `gradeCompany`, `grade`, `certNumberMasked`, quantities, and private cursors.
- Legacy search regression test.
- API build passes.

## K12.2 — Narrow source-backed response DTO

**Objective:** Use a P0 response shape that cannot leak owned inventory semantics.

**Files:**

- Create/Modify: `apps/api/src/modules/catalog/search-dto.ts`
- Modify: `apps/api/src/modules/catalog/router.ts`
- Test: DTO/schema tests.

**P0 DTO:**

```ts
export type SourceBackedSearchResult = {
  resultId: string;
  itemClass: 'CARD' | 'SEALED_PRODUCT' | 'SET';
  entityId: string;
  entitySource: 'CatalogItem' | 'CatalogSealedProduct' | 'CatalogSet';
  source: string;
  sourceItemId?: string;
  game: string;
  language?: string;
  name: string;
  imageUrl?: string | null;
  setId?: string | null;
  setName?: string | null;
  setCode?: string | null;
  rarity?: string | null;
  localId?: string | null;
  cardNumber?: string | null;
  isOwnedStock: false;
  sourceBacked: true;
  mergedSourceItems?: Array<{ source: string; sourceItemId: string; rowId: string }>;
};
```

**Entity field normalization:**

Normalize source IDs into DTO field `sourceItemId` as follows:

- `CatalogItem.sourceItemId` -> `sourceItemId`
- `CatalogSealedProduct.sourceProductId` -> `sourceItemId`
- `CatalogSet.sourceSetId` -> `sourceItemId`

Normalize image fields into DTO field `imageUrl` as follows:

- `CatalogItem`: `imageLargeUrl ?? imageThumbUrl ?? imageBaseUrl`
- `CatalogSealedProduct`: `imageUrl`
- `CatalogSet`: `logoImageUrl ?? symbolImageUrl ?? bannerImageUrl` after K15 source-priority choice

Verification additions:

- Contract test for each entity source proves normalized `sourceItemId`.
- Contract test for each entity source proves normalized `imageUrl`.

**Forbidden in P0 response:**

- `vendorId`
- `inventoryItemId`
- `customItemId`
- `gradeCompany`
- `grade`
- `certNumberMasked`
- raw cert number
- quantities/status from inventory
- raw `sourcePayload`

**Acceptance criteria:**

- Every P0 item has `sourceBacked: true` and `isOwnedStock: false`.
- Inventory/slab/custom fields are absent, not null placeholders.
- `resultId` is deterministic, e.g. `${itemClass}:${entitySource}:${entityId}`.

**Verification:**

- Contract tests for CARD/SEALED_PRODUCT/SET.
- Negative snapshot tests for forbidden keys.
- Type/schema validation test.

## K13.1 — Games and sets endpoints

**Objective:** Add first-class browse/filter endpoints backed by populated legacy tables.

**Files:**

- Modify: `apps/api/src/modules/catalog/router.ts`
- Create/Modify: `apps/api/src/modules/catalog/sets-query.ts`
- Create/Modify tests for routes.

**Endpoints:**

- `GET /v1/catalog/games`
- `GET /v1/catalog/sets`
- `GET /v1/catalog/sets/:id`

**Implementation rules:**

- Use `CatalogSet`, `CatalogItem`, and `CatalogSealedProduct` for P0.
- Do not use `CanonicalSearchDoc` as source of truth until population/maintenance is proven.
- `/games` derives available games from populated tables.
- `/sets` supports `game`, `source`, `q`, `limit`, optional date filters.
- `/sets/:id` reads by `CatalogSet.id`.
- Include card and sealed product counts using grouped aggregate queries, not per-row N+1 queries.
- Prefer TCGTracking imagery using K15.1 source priority; Bulbapedia fallback only.

**Acceptance criteria:**

- Games endpoint reflects actual populated rows.
- Sets endpoint filters and limits deterministically.
- Set detail includes card/sealed counts and source/sourceSetId.
- Count strategy is bounded and not N+1.
- TCGTracking image is selected when available/matched.

**Verification:**

- Integration tests across multiple games/sources.
- Query-count or mock assertion proves no per-row count loop.
- Aggregate SQL/Prisma groupBy inspected in test or logged artifact.
- Fixture where both fallback and TCGTracking imagery exist proves TCGTracking display choice.
- API build passes.

## K15.2 — Provenance/collapse debug hardening

**Objective:** Preserve operator traceability without exposing raw source payloads.

**Files:**

- Modify: `apps/api/src/modules/catalog/search-dedupe.ts`
- Modify: DTO/router files as needed.
- Tests for collapse/provenance.

**Rules:**

- Collapse only by stable external IDs or reviewed equivalence map.
- No name-only collapse.
- Default response may include minimal `mergedSourceItems` only.
- Admin/debug-only trace may include source rank explanation later, but not raw `sourcePayload`.
- Catalog/source priority changes never mutate `PackPrize` rows.

**Acceptance criteria:**

- Deterministic collapse order.
- Name-only near matches remain separate.
- Minimal provenance available to clients.
- Raw source payload excluded.
- `PackPrize` rows untouched by search/catalog priority changes.

**Verification:**

- Stable-ID collapse tests.
- Name-only non-collapse tests.
- Response snapshot excludes source payload.
- Test or read-only check that code path does not write `PackPrize`.

---

# P1 design/deferred tickets

## K14.1 — Vendor-owned inventory search boundary

**Objective:** Document and test the future boundary before any owned inventory search ships.

**Decision:** Do not include owned inventory fields in P0 source-backed catalog search.

**Future endpoint direction:**

- Prefer separate `GET /v1/vendor/inventory/search`.
- Alternative `scope=owned` only if RBAC/cursor/count leakage is proven safe.

**Acceptance criteria before implementation:**

- Vendor scope required.
- Cross-vendor ID/cursor/count leakage denied.
- Raw cert policy documented:
  - public/shared: no raw cert
  - vendor/admin: full cert only when authorized
  - masked cert only if product explicitly permits shared display
- `VendorInventoryItem` remains source for cert-specific slabs.

## K14.2 — Inventory item class design

**Objective:** Add explicit inventory class only when owned inventory/slab/complete-set work begins.

**Draft enum:**

```prisma
enum VendorInventoryItemClass {
  RAW_CARD
  SLAB
  SEALED_PRODUCT
  COMPLETE_SET
  CUSTOM_ITEM
  ACCESSORY
  BONUS
  LOT
}
```

**Rules:**

- Slabs/custom/accessories/bonus are not global `CatalogItem` rows.
- Complete set inventory may link to `CatalogSet` metadata but does not mutate `CatalogSet`.
- Existing `catalogItemId` remains base-card link for raw card/slab.
- Safe default for future migration required.

## K16.1 — Labels/categories taxonomy design

**Objective:** Design taxonomy separately from display/prize labels.

**Required enums before migration:**

```prisma
enum ItemLabelScope {
  GLOBAL
  VENDOR
}

enum ItemLabelKind {
  CATEGORY
  TAG
  ATTRIBUTE
  RISK
  PROMO
}

enum LabeledEntityType {
  CATALOG_ITEM
  CATALOG_SEALED_PRODUCT
  CATALOG_SET
  VENDOR_INVENTORY_ITEM
  PRIZEABLE_CATALOG_OBJECT
}
```

**Open design decisions:**

- Polymorphic label join vs per-entity join tables.
- Whether labels apply to sets and sealed products in P1 or only cards/inventory first.
- Whether hierarchical categories are needed; default defer.
- Admin/vendor ownership and review workflow.
- Query/index plan before exposing label filters.

**Acceptance before migration:**

- Labels are separate from `PackPrize.label` and `PackTemplateSlot.label`.
- Global/vendor label code collision policy defined.
- Vendor label scope cannot leak cross-vendor.
- Historical `PackPrize` snapshots are not mutated.

## K16.2 — Prizeable object / complete-set seam

**Objective:** Define prizeability without turning metadata rows into economic stock.

**Rules:**

- `CatalogSet` remains metadata/filter grouping only.
- Owned complete set should be `VendorInventoryItem` with class `COMPLETE_SET`, linked to `CatalogSet` metadata.
- Non-owned prize templates require a separate `PrizeableCatalogObject` only if product needs them.
- Pack prize snapshots freeze display/provenance/value at award time.

**Deferred model sketch:**

```prisma
model PrizeableCatalogObject {
  id           String @id @default(cuid())
  objectType   PrizeableCatalogObjectType
  game         String?
  name         String
  description  String?
  imageUrl     String?
  catalogSetId String?
  isActive     Boolean @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## K12.3 — Cursor pagination deferred

**Rules:**

- P0 first-page only.
- Max `limit=30`.
- Reject `offset`.
- Do not promise cursor fields until implemented.

---

# Final P0 order

1. K15.1 source rank registry.
2. K12.1 typed source-backed adapters.
3. K12.2 narrowed DTO.
4. K13.1 games/sets endpoints.
5. K15.2 provenance/collapse hardening.

## Definition of done for P0 PR

- No DB writes/migrations.
- Existing card search compatibility verified.
- Sealed search reads `CatalogSealedProduct`.
- Set search reads `CatalogSet`.
- Reserved future classes are empty/capability-gated.
- `sourcePayload` and inventory/private fields absent from responses.
- TCGTracking set/display priority tested.
- No name-only collapse.
- API build passes.

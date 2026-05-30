# Oripa PokemonCard.io-Quality MVP — Bounded Kanban Queue

**Board slug:** `oripa-pokemoncard-mvp`

**Repo:** `/home/yeqiuqiu/oripa_saas`

**Goal:** Build a local-repo MVP that reaches the observable `pokemoncard.io` quality bar for catalog/search UX while preserving Oripa paid-pack correctness: immutable pack prize snapshots, publish/freeze, pool hash validation, and inventory allocation before paid physical packs.

## Non-goals

- No live/staging/prod DB writes without explicit approval.
- No upstream PR until all local queue items, canaries, and final review pass.
- No cloning hidden/private `pokemoncard.io` routes, DB schema, RNG, or private internals.
- No broad deckbuilder/tournament ecosystem in MVP; only architecture-compatible hooks.

## Acceptance criteria for queue completion

1. Prisma/repo schema is reconciled against current local/livedrift evidence with additive migrations/SQL only.
2. `/v1/catalog/search` is lightweight and pokemoncard-style enough for MVP:
   - no `sourcePayload` in normal results;
   - language + source/set/rarity/card-number filters;
   - single ranked SQL or index-compatible query path;
   - tests/probes for common and no-result searches.
3. Pack creation/update preserves catalog identity into `PackPrize` snapshots.
4. LIVE/ARCHIVED packs reject prize mutation.
5. Publish/freeze creates deterministic `Pack.poolSnapshotHash` and idempotent publish metadata.
6. Draw handler verifies the frozen pool hash before HMAC selection.
7. Physical paid packs have inventory reservation/allocation model or are explicitly blocked until inventory exists.
8. Facets/typeahead/vendor UI exist at MVP level.
9. Template/version/slot foundation can publish into frozen packs without bypassing P0 safety.
10. Canaries pass locally; build/type checks pass; final diff review finds no P0/P1 gaps.

## Recovery path

- If a task fails twice, block it with exact failing command/log and do not continue dependent tasks.
- If migration/schema drift is ambiguous, stop before generating migrations and require explicit user/DB approval.
- If tests cannot run because env/deps are missing, document exact blocker and add a setup gate.

## Dedupe rule

Each queue card has an idempotency key `oripa-pokemoncard-mvp:<task-id>`. Do not create duplicate cards; update/comment existing cards if scope changes.

## Queue

### K0 — Read-only repo/live-schema preflight and migration safety gate

**Scope:** Inspect current Prisma schema, existing SQL/migrations, local DB env availability, current catalog indexes evidence, and dirty worktree. Produce a safety report under `docs/plans/`.

**Acceptance:** No migrations are generated. Report states exact schema drift risks and implementation constraints.

### K1 — Catalog search hot-path MVP

**Depends:** K0

**Scope:** Implement lightweight `/v1/catalog/search` changes: remove heavy payload, add language/structured filters, and replace sequential waterfall with ranked/index-compatible query path where safe.

**Acceptance:** Tests/probes prove response shape and ranking/filter behavior. Build/typecheck targeted API.

### K2 — PackPrize catalog identity snapshot persistence

**Depends:** K1

**Scope:** Shared schemas and pack API accept catalog refs; server fetches authoritative `CatalogItem`; `PackPrize` stores catalog refs + immutable snapshot fields.

**Acceptance:** Tests cover catalog-backed prize, manual prize, and snapshot source authority.

### K3 — Live pack immutability guard

**Depends:** K2

**Scope:** Reject prize/pool mutation on LIVE/ARCHIVED packs; preserve DRAFT edit behavior.

**Acceptance:** Tests prove LIVE/ARCHIVED mutation rejection and DRAFT mutation allowed.

### K4 — Publish/freeze endpoint and pool hash

**Depends:** K3

**Scope:** Add `Pack.poolSnapshotHash`, publish metadata, deterministic canonical pool JSON/hash utility, idempotent publish/freeze endpoint.

**Acceptance:** Tests prove deterministic hash, idempotency, freeze transition, and no mutation after freeze.

### K5 — Draw-time frozen pool integrity verification

**Depends:** K4

**Scope:** Draw handler verifies computed prize pool hash equals frozen `Pack.poolSnapshotHash` before HMAC selection; fairness proof stores frozen hash.

**Acceptance:** Tests prove draw rejects tampered pool and succeeds when hash matches.

### K6 — Vendor inventory allocation foundation

**Depends:** K5

**Scope:** Add local schema/model foundation for `VendorInventoryItem` and `PackPrizeInventoryAllocation`; publish/freeze reserves inventory or blocks physical paid pack publish without allocatable inventory.

**Acceptance:** Tests prove cross-vendor inventory references rejected, oversell blocked, allocation state changes are transactional.

### K7 — Facets/typeahead/vendor catalog UX

**Depends:** K6

**Scope:** Add MVP `GET /v1/catalog/facets` and lightweight typeahead/suggest endpoint; wire vendor UI to preserve `catalogItemId` and URL/filter state.

**Acceptance:** API tests/probes + web build prove filters/typeahead compile and preserve catalog refs.

### K8 — Template/version/slot MVP

**Depends:** K7

**Scope:** Add template/version/slot models and minimal API path to publish a vendor template into a frozen pack using P0 safety path.

**Acceptance:** Tests prove template edits do not mutate live packs; publishing creates immutable Pack + PackPrize snapshots and pool hash.

### K9 — Local canaries, full verification, PR-readiness packet

**Depends:** K8

**Scope:** Run local canaries and full feasible verification. Produce final MVP status report, remaining gaps, and PR checklist. Do not open PR.

**Acceptance:** Root build/type checks and targeted canaries pass or exact blockers documented; final report maps every acceptance criterion to evidence.

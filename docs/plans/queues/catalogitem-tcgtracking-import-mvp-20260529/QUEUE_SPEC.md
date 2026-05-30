# CatalogItem + TCGTracking import-only MVP — bounded Kanban queue

## Source plan

- Plan: `docs/plans/catalogitem-tcgtracking-plan.md`
- Oracle review: `docs/plans/catalogitem-tcgtracking-oracle-review.md`
- Oracle evidence: `docs/plans/catalogitem-tcgtracking-oracle-evidence.md`
- Import-only Oracle artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T051659Z_catalogitem-tcgtracking-import-only-pass1/oracle_response.md`

## Goal

Implement the import-only MVP: source-backed TCGTracking category `3` Pokémon card data imported into global `CatalogItem` rows with dry-run-first guardrails, fixture-backed deterministic normalization, report/runbook, and no pack API/UI behavior changes.

## Non-goals / hard boundaries

Do **not** implement these in this queue:

- `PackPrize.catalogItemId` or any PackPrize schema/model relation changes.
- Shared pack schemas, pack create/update/read API, public DTO leak work, or vendor UI selection/edit flow.
- Category `85` / Pokémon Japan import. Category `3` only for this MVP.
- Vendor inventory, stock, ownership, fulfillment, certs, cost basis, authentication/vaulting/insurance claims, exact live odds/fairness proof.
- Live Render DB mutations without explicit user approval plus backup/snapshot confirmation.

## Worker envelope

- Board: `oripa-catalogitem-tcgtracking-mvp-20260529`
- Assignee for every implementation card: `coding-kanban`
- Effective model: `openai-codex / gpt-5.3-codex` from `/home/yeqiuqiu/.hermes/profiles/coding-kanban/config.yaml` unless a task-level model override is added later. Current queue uses no override.
- Workspace: `dir:/home/yeqiuqiu/oripa_saas`
- Required worker skill: `software-development/test-driven-development` plus built-in `kanban-worker`
- Max runtime per card: `90m`
- Max retries per card: `1` (block on first failure; controller/user reviews before retry)
- Dependencies: serial chain. Only the first card should be runnable initially; each next card waits for its predecessor.

## Required proof per card

Each completed card must include:

- Changed files list.
- Commands run with exit codes.
- Whether any DB access was attempted, and confirmation that no live DB write happened unless the card explicitly had approval.
- Scope proof that no deferred pack/API/UI files were modified unless the task explicitly only inspected them.
- If blocked, exact missing decision/credential/environment and the safest next action.

## Serial gate order

1. Schema/SQL preflight: confirm `CatalogItem` fields/indexes and idempotent SQL posture; no live DB mutation.
2. Fixture capture: capture category `3` TCGTracking source fixtures and record actual key paths. Normalizer coding is blocked until this passes.
3. Fixture-backed normalizer/tests: replace TCGdex-era normalizer/test names with TCGTracking mapping and deterministic missing-field behavior.
4. Safe importer guardrails: implement/repair `sync-tcgtracking.ts` with dry-run default, explicit `TCGTRACKING_DB_ENV`, category `3` hard guard, same-environment smoke before writes, and operational logging.
5. Migration/runbook: create/repair `prisma/sql/catalogitem-tcgtracking.sql` and `docs/runbooks/catalogitem-tcgtracking-import.md` with backup, timeouts, pilot, inspection, rollback.
6. Catalog report: add `apps/api/scripts/catalog-report.ts` and package script.
7. Local QA gate: run test/build/dry-run/report checklist; local DB writes only if safely pointed at a local DB, never with the current live Render `.env`.
8. Staging rollout gate: prepare/execute only safe dry-run and evidence steps; block for any staging DB write approval/environment if not explicitly available.
9. Production/live gate: block for explicit user approval + backup/snapshot before any live SQL/import write; may prepare commands/evidence only.

## Final acceptance criteria

- `npm run test:catalog:tcgtracking -w @oripa/api` passes.
- `npm run build -w @oripa/api` passes or unrelated pre-existing failures are isolated with evidence.
- TCGTracking dry-run command with `TCGTRACKING_DB_ENV=local`, `TCGTRACKING_DRY_RUN=true`, `TCGTRACKING_CATEGORY_ID=3`, `TCGTRACKING_MAX_SETS=1`, `TCGTRACKING_MAX_CARDS=10` prints sample rows and `upserted=0`.
- `npm run catalog:report -w @oripa/api` prints source counts and recent sample rows.
- No pack API/UI behavior changes are included.
- Live DB SQL/import writes remain unexecuted unless explicit approval and backup/snapshot evidence are supplied.

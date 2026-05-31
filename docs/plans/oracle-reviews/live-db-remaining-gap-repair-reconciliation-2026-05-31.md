# Oracle-style reconciliation — remaining live DB gap repair plan

Date: 2026-05-31

Scope:
- Plan reviewed: `docs/plans/live-db-gap-closure-oracle-plan-2026-05-31.md`
- Audit reviewed: `docs/plans/live-db-missing-audit-2026-05-31T01-58-33-021Z.md` and JSON sibling
- Live Oracle CLI preflight: `oracle 0.13.0`, `gpt-5.5-pro: not ready`, missing `OPENAI_API_KEY`
- Fallback used: bounded independent Oracle-style review lanes per `oracle` skill.

## Verdict before revision

NOT CLEAN.

The plan had the right architecture but needed reconciliation patches before implementation:

1. `CatalogItem.sourcePayload` copied/legacy payloads needed a discriminated trust/provenance contract so downstream readers do not confuse derivative payloads with native source payloads.
2. `CatalogSet` image writes needed image-level provenance because image URL columns are source-agnostic.
3. `tcgtracking/POKEMON/ja` set image wording overstated same-source image candidates despite audit showing `447/447` missing images.
4. PackPrize needed explicit app/audit guardrails to prevent sealed products from entering card snapshot paths until sealed snapshot builder exists.
5. Production apply safety needed pre-mutation rollback SQL, batch sizing, rollback validation, explicit `DB_REMEDIATION_DB_ENV`, and a no-concurrent-remediation gate.
6. Workstream A needed its test/package script in verification commands.
7. Preflight script location/import convention needed to be explicit.
8. Search contract tests needed concrete assertions.

## Required plan revisions applied

Patched `docs/plans/live-db-gap-closure-oracle-plan-2026-05-31.md` to include:

- Oracle reconciliation patch log and live Oracle preflight result.
- Embedded payload trust contract using `__oripaPayloadTrust` / `__oripaPayloadProvenance` metadata for copied/legacy payloads, with audit/test requirements and no public raw-payload exposure.
- Image provenance contract stored in `CatalogSet.sourcePayload.__oripaImageProvenance` before setting source-agnostic image URL columns.
- Corrected `POKEMON/ja` image handling: same-source only if actual sourcePayload URL evidence exists; otherwise `missing_source`.
- Sealed/PackPrize guardrails: no `CatalogItem.itemType='SEALED_PRODUCT'`; catalog-backed PackPrize card snapshots require `CatalogItem.itemType='CARD'`; sealed products blocked until sealed snapshot builder exists.
- Production-safety hardening: rollback SQL path written/logged before mutation, dry-run rollback SQL syntax validation, 500-row batch cap by default, explicit DB_ENV always, advisory lock/single-operator constraint, prior-remediation rollback note.
- Workstream A package script: `test:catalog:live-db-audit-classification`.
- Preflight root script convention: `scripts/verify-live-db-gap-preflight.js`, CommonJS, `new PrismaClient()` like audit script; run via `node scripts/verify-live-db-gap-preflight.js`.
- Search test assertions for typed result shape, sealed/set discoverability, and `prizeableNow` false/absent.

## Final review target

The revised plan should be considered implementation-ready only after final gate confirms all patches above are present. Production DB writes remain blocked until dry-run artifacts and explicit user approval for apply flags.

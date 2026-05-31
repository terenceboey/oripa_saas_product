# Oracle-style final gate — remaining live DB gap repair plan

Date: 2026-05-31

Scope:
- Revised plan: `docs/plans/live-db-gap-closure-oracle-plan-2026-05-31.md`
- Reconciliation artifact: `docs/plans/oracle-reviews/live-db-remaining-gap-repair-reconciliation-2026-05-31.md`
- Audit report: `docs/plans/live-db-missing-audit-2026-05-31T01-58-33-021Z.md`

Live Oracle CLI status:
- `oracle 0.13.0`
- `gpt-5.5-pro: not ready`
- Reason: missing `OPENAI_API_KEY`

Fallback used: bounded independent Oracle-style final gate per `oracle` skill.

## Verdict

CLEAN.

## Gate checks

All reconciliation blockers are addressed in the revised plan:

1. Payload trust/provenance contract — addressed via `__oripaPayloadTrust` and `__oripaPayloadProvenance` in cross-cutting rules, Workstream B, and Workstream C.
2. Image provenance for source-agnostic `CatalogSet` image URL columns — addressed via `CatalogSet.sourcePayload.__oripaImageProvenance` in Workstream D.
3. `tcgtracking/POKEMON/ja` image candidate wording — corrected; same-source only if dry-run proves actual URL evidence, otherwise `missing_source`.
4. Sealed/PackPrize guardrails — `CatalogItem.itemType='SEALED_PRODUCT'` blocked for current path; card PackPrize snapshots require `itemType='CARD'`; sealed PackPrize rows blocked until sealed snapshot builder exists.
5. Production apply safety — rollback SQL before mutation, rollback validation in dry-run, 500-id default batch cap, explicit `DB_REMEDIATION_DB_ENV`, advisory/single-operator lock, recovery procedure.
6. Workstream A package script — `test:catalog:live-db-audit-classification` added to plan and verification commands.
7. Preflight location/import convention — root `scripts/verify-live-db-gap-preflight.js`, CommonJS, `new PrismaClient()` convention documented; API remediation scripts keep `../src/lib/prisma`.
8. Search contract tests — concrete assertions required for `entityType`/`catalogClass`, sealed results, set results, and `prizeableNow` false/absent.

## Implementation gate

Plan is implementation-ready, but production writes remain blocked until:

- targeted tests exist and pass,
- preflight artifact is generated,
- dry-run artifacts are reviewed,
- rollback SQL artifacts are generated before mutation,
- explicit production apply approval is given with the required flags.

VERDICT: NOT CLEAN

The plan is close and the reconciliation patch fixes the major prior blockers, but one material blocker remains: **not every remaining audit gap is explicitly repaired or classified.** The biggest miss is `CatalogSet.sourceCategoryId` / `CatalogSet.productCount` coverage. The plan itself says CatalogSet’s remaining gaps include “set image/source-category/product-count coverage,” yet the workstreams only provide a detailed remediation/classification policy for set images, not for source-category and product-count gaps.

Required revisions:

1. **Add explicit CatalogSet source-category/product-count taxonomy.**
   Evidence: the audit table shows non-image CatalogSet gaps: `bulbapedia/POKEMON` has `144/144` missing `source_category_id` and `144/144` missing `product_count`; `onepiecedb.io/ONE_PIECE` has `51/51` missing `source_category_id`; `pokemoncard.io/POKEMON` has `196/196` missing `source_category_id`; `tcgtracking/POKEMON_JAPAN` has `446/446` missing `source_category_id`. The plan’s Workstream A reclassification list covers `CatalogSet` missing images, `VendorInventoryItem=0`, manual/demo `PackPrize`, and possible sealed `CatalogItem` rows, but does **not** explicitly classify these CatalogSet source-category/product-count gaps.
   Revision: add a Workstream A rule such as: `CatalogSet.sourceCategoryId/productCount` gaps are `source_metadata_gap` when the upstream source has no category/count concept, `remediable_db_gap` when deterministic source/category mapping exists, and `licensing_or_policy_gate` when source data exists but cannot be copied. Include `writeAllowed`, `safeAction`, and `expectedRemainingAfterPlan`.

2. **Fix the final-audit expected-remaining categories.**
   Evidence: the execution sequence says final remaining issues should only be `source_image_gap`, `product_lane_absent`, `demo_fixture_gap`, or policy gates. That omits `source_metadata_gap`, even though Workstream A defines it and Workstream B explicitly allows legacy-only low-trust payloads to remain classified rather than source-restored.
   Revision: include `source_metadata_gap` in the final expected-remaining issue classes, or state that all source-metadata gaps must be reduced to zero before final audit.

3. **Add explicit verification commands/package scripts for Search and PackPrize guardrail tests.**
   Evidence: Workstream E requires concrete search assertions for `entityType`/`catalogClass`, sealed search, set search, and `prizeableNow` false/absent; Workstream G names `test-pack-prize-catalog-snapshots.ts`. But the verification command block only runs live DB remediation, audit classification, source payload, sealed product, and set-image tests; it does not include a search-contract test or PackPrize snapshot/guardrail test.
   Revision: add package scripts, for example `test:catalog:search-contract` and `test:packs:catalog-snapshots`, and include both in the verification commands before final audit.

What is already clean:

* **Source provenance/fabrication controls:** copied and legacy payloads are explicitly not native payloads and must carry `__oripaPayloadTrust` / `__oripaPayloadProvenance`; image writes must record `__oripaImageProvenance`; guessed set images are forbidden.
* **Production write safety:** dry-run/apply gates, explicit production flags, rollback SQL before mutation, rollback validation, batch caps, DB env requirement, and concurrency lock requirement are present.
* **PackPrize/sealed boundary:** current sealed products are kept out of `CatalogItem` card paths; catalog-backed PackPrize card snapshots must require `CatalogItem.itemType='CARD'`; sealed PackPrize support is blocked until a sealed snapshot builder exists.
* **Vendor inventory boundary:** `VendorInventoryItem=0` is treated as an absent product lane, not something to synthesize from catalog rows.

Bottom line: **the core architecture is sound, but the plan is not clean until CatalogSet non-image metadata gaps and missing verification gates are explicitly closed or classified.**

import assert from "node:assert/strict";
import {
  assertNoUnexpectedFinalCategories,
  classifyCatalogSetProductCount,
  classifyCatalogSetSourceCategoryId,
  expectedFinalGapCategories,
} from "./live-db-audit-classification";

const category = classifyCatalogSetSourceCategoryId({ missing: 12, deterministicCandidates: 12 });
assert.equal(category.category, "remediable_db_gap");
assert.equal(category.candidateClass, "deterministic_source_mapping");
assert.equal(category.writeAllowed, true);
assert.equal(category.expectedRemainingAfterPlan, false);
assert.equal(category.blockedBy, null);

const unavailableCategory = classifyCatalogSetSourceCategoryId({ missing: 7, deterministicCandidates: 3 });
assert.equal(unavailableCategory.category, "source_metadata_gap");
assert.equal(unavailableCategory.writeAllowed, false);
assert.equal(unavailableCategory.expectedRemainingAfterPlan, true);
assert.match(unavailableCategory.safeAction, /do not fabricate/i);

const ambiguousCount = classifyCatalogSetProductCount({ missing: 9, deterministicCandidates: 9, ambiguous: true });
assert.equal(ambiguousCount.category, "source_metadata_gap");
assert.equal(ambiguousCount.candidateClass, "ambiguous");
assert.equal(ambiguousCount.writeAllowed, false);
assert.equal(ambiguousCount.blockedBy, "ambiguous_product_count_semantics");

const sourceCount = classifyCatalogSetProductCount({ missing: 9, deterministicCandidates: 9, countSemantics: "source_total" });
assert.equal(sourceCount.category, "remediable_db_gap");
assert.equal(sourceCount.writeAllowed, true);

const localOnlyCount = classifyCatalogSetProductCount({ missing: 9, deterministicCandidates: 9, countSemantics: "none" });
assert.equal(localOnlyCount.category, "source_metadata_gap");
assert.equal(localOnlyCount.writeAllowed, false);

assert.ok(expectedFinalGapCategories().includes("source_metadata_gap"));
assert.doesNotThrow(() =>
  assertNoUnexpectedFinalCategories([
    { category: "source_image_gap" },
    { category: "source_metadata_gap" },
    { category: "demo_fixture_gap" },
  ]),
);
assert.throws(() => assertNoUnexpectedFinalCategories([{ category: "remediable_db_gap" }]), /Unexpected final remediable categories/);

console.log("live DB audit classification tests passed");

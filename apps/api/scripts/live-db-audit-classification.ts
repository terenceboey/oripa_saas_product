export type LiveDbIssueCategory =
  | "remediable_db_gap"
  | "source_metadata_gap"
  | "source_image_gap"
  | "product_lane_absent"
  | "demo_fixture_gap"
  | "licensing_or_policy_gate";

export type LiveDbIssueSeverity = "P0" | "P1" | "P2";

export type LiveDbIssueV2 = {
  severity: LiveDbIssueSeverity;
  model: string;
  message: string;
  category: LiveDbIssueCategory;
  sourceOfTruth: string;
  safeAction: string;
  blockedBy: string | null;
  writeAllowed: boolean;
  expectedRemainingAfterPlan: boolean;
  data?: unknown;
};

export type CatalogSetMetadataClass =
  | "deterministic_source_mapping"
  | "source_has_no_metadata"
  | "policy_blocked"
  | "ambiguous"
  | "already_complete";

export function classifyCatalogSetSourceCategoryId(input: {
  missing: number;
  deterministicCandidates?: number;
  policyBlocked?: boolean;
  ambiguous?: boolean;
}): { category: LiveDbIssueCategory; candidateClass: CatalogSetMetadataClass; writeAllowed: boolean; expectedRemainingAfterPlan: boolean; safeAction: string; blockedBy: string | null } {
  if (input.missing <= 0) {
    return {
      category: "source_metadata_gap",
      candidateClass: "already_complete",
      writeAllowed: false,
      expectedRemainingAfterPlan: true,
      safeAction: "No action; sourceCategoryId already complete.",
      blockedBy: null,
    };
  }
  if (input.policyBlocked) {
    return {
      category: "licensing_or_policy_gate",
      candidateClass: "policy_blocked",
      writeAllowed: false,
      expectedRemainingAfterPlan: true,
      safeAction: "Do not copy source category metadata until policy/licensing gate is resolved.",
      blockedBy: "policy_or_license_review",
    };
  }
  if (input.ambiguous) {
    return {
      category: "source_metadata_gap",
      candidateClass: "ambiguous",
      writeAllowed: false,
      expectedRemainingAfterPlan: true,
      safeAction: "Leave classified as ambiguous metadata; require upstream/source-specific review before writing.",
      blockedBy: "ambiguous_source_category_mapping",
    };
  }
  if ((input.deterministicCandidates ?? 0) >= input.missing) {
    return {
      category: "remediable_db_gap",
      candidateClass: "deterministic_source_mapping",
      writeAllowed: true,
      expectedRemainingAfterPlan: false,
      safeAction: "Backfill sourceCategoryId from deterministic same-source category mapping using guarded remediation script.",
      blockedBy: null,
    };
  }
  return {
    category: "source_metadata_gap",
    candidateClass: "source_has_no_metadata",
    writeAllowed: false,
    expectedRemainingAfterPlan: true,
    safeAction: "Classify as source metadata unavailable; do not fabricate a category id.",
    blockedBy: "source_does_not_expose_category_id",
  };
}

export function classifyCatalogSetProductCount(input: {
  missing: number;
  deterministicCandidates?: number;
  policyBlocked?: boolean;
  ambiguous?: boolean;
  countSemantics?: "source_total" | "local_indexed_count" | "none";
}): { category: LiveDbIssueCategory; candidateClass: CatalogSetMetadataClass; writeAllowed: boolean; expectedRemainingAfterPlan: boolean; safeAction: string; blockedBy: string | null } {
  if (input.missing <= 0) {
    return {
      category: "source_metadata_gap",
      candidateClass: "already_complete",
      writeAllowed: false,
      expectedRemainingAfterPlan: true,
      safeAction: "No action; productCount already complete.",
      blockedBy: null,
    };
  }
  if (input.policyBlocked) {
    return {
      category: "licensing_or_policy_gate",
      candidateClass: "policy_blocked",
      writeAllowed: false,
      expectedRemainingAfterPlan: true,
      safeAction: "Do not copy source count metadata until policy/licensing gate is resolved.",
      blockedBy: "policy_or_license_review",
    };
  }
  if (input.ambiguous) {
    return {
      category: "source_metadata_gap",
      candidateClass: "ambiguous",
      writeAllowed: false,
      expectedRemainingAfterPlan: true,
      safeAction: "Leave productCount unset; source count semantics are ambiguous.",
      blockedBy: "ambiguous_product_count_semantics",
    };
  }
  if ((input.deterministicCandidates ?? 0) >= input.missing && input.countSemantics !== "none") {
    return {
      category: "remediable_db_gap",
      candidateClass: "deterministic_source_mapping",
      writeAllowed: true,
      expectedRemainingAfterPlan: false,
      safeAction: "Backfill productCount only from deterministic same-source count metadata.",
      blockedBy: null,
    };
  }
  return {
    category: "source_metadata_gap",
    candidateClass: "source_has_no_metadata",
    writeAllowed: false,
    expectedRemainingAfterPlan: true,
    safeAction: "Classify as source metadata unavailable; do not fabricate counts from partial local rows.",
    blockedBy: "source_does_not_expose_trusted_product_count",
  };
}

export function expectedFinalGapCategories(): LiveDbIssueCategory[] {
  return [
    "source_image_gap",
    "source_metadata_gap",
    "product_lane_absent",
    "demo_fixture_gap",
    "licensing_or_policy_gate",
  ];
}

export function assertNoUnexpectedFinalCategories(issues: Array<{ category: LiveDbIssueCategory }>) {
  const allowed = new Set(expectedFinalGapCategories());
  const blockers = issues.filter((issue) => !allowed.has(issue.category));
  if (blockers.length) {
    throw new Error(`Unexpected final remediable categories remain: ${blockers.map((issue) => issue.category).join(", ")}`);
  }
}

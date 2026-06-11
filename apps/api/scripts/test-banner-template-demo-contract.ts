import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BANNER_TEMPLATE_REGISTRY } from "../src/modules/creative/service";
import { createCampaignCreativeSchema, PROMPT_PACK_TEMPLATES } from "@oripa/shared";

const repoRoot = path.resolve(__dirname, "../../..");
const prunedWebPagePath = path.join(repoRoot, "apps/web/app/vendor/banner-templates/page.tsx");
const backendDocsPath = path.join(repoRoot, "docs/v2/BANNER_CREATIVE_BACKEND.md");
const backendDocs = fs.readFileSync(backendDocsPath, "utf8");
const normalizedBackendDocs = backendDocs.toLowerCase();

const sharedTemplates = PROMPT_PACK_TEMPLATES;

assert.equal(sharedTemplates.length, 90, "shared prompt pack exposes all 90 banner themes");
assert.equal(BANNER_TEMPLATE_REGISTRY.length, sharedTemplates.length, "API registry uses the same 90-template prompt pack");
assert.deepEqual(
  BANNER_TEMPLATE_REGISTRY.map((template) => template.id),
  sharedTemplates.map((template) => template.id),
  "API registry order matches shared prompt pack order",
);

const ids = new Set(sharedTemplates.map((template) => template.id));
assert.equal(ids.size, 90, "all 90 banner template ids are unique");
assert.deepEqual(
  sharedTemplates.map((template) => template.promptPackIndex),
  Array.from({ length: 90 }, (_, index) => index + 1),
  "prompt pack indexes are contiguous from 1 through 90",
);
assert.ok(ids.has("jp_arcade_guaranteed_hit_v1"), "default guaranteed-hit template is present");

const validHeroAssets = [{
  assetId: "source_upload:test-contract",
  source: "upload" as const,
  imageUrl: "/creative-storage/private/source-assets/vendor_1/2026-06-11/test.png",
  displayName: "Contract test source image",
  snapshotHash: "a".repeat(64),
  contentHash: "b".repeat(64),
}];
for (const template of sharedTemplates) {
  const result = createCampaignCreativeSchema.safeParse({
    templateId: template.id,
    bannerRatio: template.defaults.bannerRatio,
    styleIntensity: template.defaults.styleIntensity,
    mascotMode: template.defaults.mascotMode,
    cardDisplayStyle: template.defaults.cardDisplayStyle,
    heroAssets: validHeroAssets,
    primaryHeroAssetId: validHeroAssets[0].assetId,
    fields: template.defaults.fields,
  });
  assert.equal(result.success, true, `template defaults should submit for ${template.id}`);
}

assert.equal(
  fs.existsSync(prunedWebPagePath),
  false,
  "standalone frontend demo page stays pruned from backend handoff PR",
);

for (const requiredText of [
  "Option A — direct GPT Image 2 provider",
  "Option B — Hermes / Oracle browser handoff",
  "Option C — manual candidate upload / manual row creation",
  "source images are mandatory",
  "public publish remains blocked",
]) {
  assert.ok(normalizedBackendDocs.includes(requiredText.toLowerCase()), `backend docs include ${requiredText}`);
}

console.log("banner template backend handoff contract passed");

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  BANNER_TEMPLATE_REGISTRY,
  assertPromptSafe,
  buildPromptBundle,
  buildForbiddenTerms,
  buildPrivateDraftAsset,
  buildSafeCreativePrompt,
  buildBannerCardAssetsFromPack,
  buildGptImage2GenerationRequest,
  compileBannerTemplatePrompt,
  createBannerTemplateDraftAsset,
  createManualCreativeCandidateAsset,
  createProviderGeneratedCreativeCandidateAsset,
  markCreativeCandidateReviewed,
  getBannerTemplate,
  snapshotPackForCreative,
  snapshotPrizesForCreative,
} from "../src/modules/creative/service";
import { fetchAndPersistCardImage, findHermesHandoffOutputImages, isUnsafeCreativeRemoteAddress, persistCardImageCache, persistCreativeCandidateImage, persistVendorSourceImage, readCachedCardImage } from "../src/lib/creative-storage";
import {
  createCampaignCreativeSchema,
  createGptImage2CreativeGenerationSchema,
  createManualCreativeCandidatesSchema,
  reviewCreativeAssetSchema,
} from "@oripa/shared";

const pack = {
  id: "cmvpcreativepack001",
  title: "Charizard Chase Pack",
  status: "DRAFT",
  pricePoints: 100,
  totalStock: 10,
  remainingStock: 10,
  startsAt: new Date("2026-06-20T10:00:00.000Z"),
  endsAt: new Date("2026-06-21T10:00:00.000Z"),
  importantNotes: "VIP launch with strict one-draw limit.",
  drawLimitMode: "ONCE_PER_CUSTOMER",
  drawLimitValue: 1,
  drawLimitResetTimezone: "Asia/Tokyo",
  poolSnapshotHash: "f".repeat(64),
  tierSnapshotJson: {
    version: 1,
    tiers: [
      {
        name: "S Tier",
        percentage: 10,
        items: [{ label: "Charizard ex Special Illustration Rare", estimatedValue: 500, stock: 1, imageUrl: "https://images.example.test/charizard-large.png" }],
      },
      {
        name: "A Tier",
        percentage: 90,
        items: [{ label: "Generic sealed booster", estimatedValue: 50, stock: 9, imageUrl: "https://images.example.test/booster.png" }],
      },
    ],
  },
  prizes: [
    {
      id: "p1",
      label: "Charizard ex Special Illustration Rare",
      imageUrl: "https://images.example.test/charizard.png",
      imageLargeUrl: "https://images.example.test/charizard-large.png",
      setId: "sv3pt5",
      setName: "Scarlet & Violet 151",
      localId: "199",
      cardNumber: "199/165",
      rarity: "Special Illustration Rare",
      estimatedValue: 500,
      weight: 1,
      stock: 1,
      remainingStock: 1,
      catalogItemId: "catalog-1",
      catalogSource: "tcgtracking",
      catalogSourceItemId: "tcgt-1",
      catalogSnapshot: { source: "fixture" },
    },
    {
      id: "p2",
      label: "Generic sealed booster",
      imageUrl: "https://images.example.test/booster.png",
      estimatedValue: 50,
      weight: 50,
      stock: 9,
      remainingStock: 9,
    },
  ],
};

const prompt = buildSafeCreativePrompt("premium_foil");
const forbidden = buildForbiddenTerms(pack);
assert.doesNotThrow(() => assertPromptSafe(prompt, forbidden));
assert.throws(() => assertPromptSafe(`${prompt} Charizard`, forbidden), /leaked protected terms/);

const packSnapshot = snapshotPackForCreative(pack);
assert.equal(packSnapshot.id, pack.id);
assert.equal(packSnapshot.status, "DRAFT");
assert.equal(packSnapshot.pricePoints, 100);
assert.equal(packSnapshot.totalStock, 10);
assert.equal(packSnapshot.remainingStock, 10);
assert.equal(packSnapshot.drawRules.mode, "ONCE_PER_CUSTOMER");
assert.equal(packSnapshot.drawRules.limitValue, 1);
assert.equal(packSnapshot.drawRules.resetTimezone, "Asia/Tokyo");
assert.equal(packSnapshot.poolSnapshotHash, "f".repeat(64));
assert.equal(packSnapshot.tierOdds[0].name, "S Tier");
assert.equal(packSnapshot.tierOdds[0].percentage, 10);
assert.equal(packSnapshot.tierOdds[0].stock, 1);
assert.equal(packSnapshot.tierOdds[1].name, "A Tier");
assert.equal(packSnapshot.tierOdds[1].percentage, 90);
assert.equal(packSnapshot.notes, "VIP launch with strict one-draw limit.");

const prizeSnapshot = snapshotPrizesForCreative(pack);
assert.equal(prizeSnapshot.length, 2);
assert.equal(prizeSnapshot[0].catalogItemId, "catalog-1");
assert.equal(prizeSnapshot[0].label, "Charizard ex Special Illustration Rare");

const bannerCardAssets = buildBannerCardAssetsFromPack(pack);
assert.equal(bannerCardAssets.length, 2);
assert.deepEqual(bannerCardAssets.map((asset) => asset.id), ["pack_prize:p1", "pack_prize:p2"]);
assert.equal(bannerCardAssets[0].source, "pack_prize");
assert.equal(bannerCardAssets[0].packPrizeId, "p1");
assert.equal(bannerCardAssets[0].catalogItemId, "catalog-1");
assert.equal(bannerCardAssets[0].imageUrl, "https://images.example.test/charizard-large.png");
assert.equal(bannerCardAssets[0].eligibleForPublish, true);
assert.equal(bannerCardAssets[0].snapshotHash.length, 64);
assert.ok(bannerCardAssets[0].searchText.includes("charizard"));

const assetA = buildPrivateDraftAsset(pack, "premium_foil");
const assetB = buildPrivateDraftAsset(pack, "premium_foil");
assert.equal(assetA.contentHash, assetB.contentHash);
assert.equal(assetA.targetUrl, `/packs/${pack.id}`);
assert.match(assetA.imageUrl, /^data:image\/svg\+xml;utf8,/);
assert.ok(assetA.imageUrl.includes(encodeURIComponent("Charizard ex Special Illustration Rare")));
assert.equal(assetA.metadata.aiProvider, "none_mock_background_only");

const template = getBannerTemplate("jp_arcade_guaranteed_hit_v1");
assert.equal(template.id, "jp_arcade_guaranteed_hit_v1");
assert.equal(template.defaults.bannerRatio, "3:2");
assert.ok(template.fields.some((field) => field.key === "headline"));
assert.equal(BANNER_TEMPLATE_REGISTRY.length, 90);
assert.ok(BANNER_TEMPLATE_REGISTRY.some((candidate) => candidate.id === "gacha_banner_090_victory_is_at_hand"));
const firstTemplate = getBannerTemplate("gacha_banner_001_guarantee_value_gacha");
assert.equal(firstTemplate.defaults.fields.headline, "GUARANTEE VALUE GACHA");
assert.equal(firstTemplate.defaults.fields.topRightBadge, "MINIMUM GUARANTEE 2,200pt");

const templatePayload = {
  templateId: "jp_arcade_guaranteed_hit_v1",
  bannerRatio: "3:2",
  styleIntensity: "insane_arcade",
  mascotMode: "primary_card_inspired",
  cardDisplayStyle: "generic_graded_slabs",
  heroCardIds: ["p1", "p2"],
  primaryCardId: "p1",
  fields: {
    headline: "GUARANTEED HIT MYSTERY PACK",
    topLeftBadge: "TOTAL RETURN RATE OVER 100%",
    topCenterBadge: "24-HOUR OFFER FOR NEW MEMBERS",
    topRightBadge: "GUARANTEED 5,500 PT",
    roundSticker: "LIMIT ONE PER CUSTOMER",
  },
};
const schemaResult = createCampaignCreativeSchema.safeParse(templatePayload);
assert.equal(schemaResult.success, true);

const uploadFirstPayload = {
  ...templatePayload,
  heroCardIds: undefined,
  primaryCardId: undefined,
  heroAssets: [
    {
      assetId: "source_upload_1",
      source: "upload" as const,
      imageUrl: "http://localhost:4000/creative-storage/private/source-assets/vendor_1/2026-06-10/vendor-card.png",
      displayName: "Vendor uploaded chase card",
      snapshotHash: "a".repeat(64),
      contentHash: "b".repeat(64),
    },
  ],
};
const uploadFirstSchemaResult = createCampaignCreativeSchema.safeParse(uploadFirstPayload);
assert.equal(uploadFirstSchemaResult.success, true);
const unsafeUploadFirstSchemaResult = createCampaignCreativeSchema.safeParse({
  ...uploadFirstPayload,
  heroAssets: [{ ...uploadFirstPayload.heroAssets[0], imageUrl: "http://127.0.0.1:4000/admin-only.png" }],
});
assert.equal(unsafeUploadFirstSchemaResult.success, false);

const compiled = compileBannerTemplatePrompt(templatePayload, pack);
assert.ok(compiled.prompt.includes("GUARANTEED HIT MYSTERY PACK"));
assert.ok(compiled.prompt.includes("TOTAL RETURN RATE OVER 100%"));
assert.ok(compiled.prompt.includes("Pack economics / draw rules"));
assert.ok(compiled.prompt.includes("Price: 100 points per draw"));
assert.ok(compiled.prompt.includes("Stock: 10 remaining of 10 total"));
assert.ok(compiled.prompt.includes("Draw limit: ONCE_PER_CUSTOMER (1 per customer)"));
assert.ok(compiled.prompt.includes("S Tier: 10% chance, 1 item, 1 stock"));
assert.ok(compiled.prompt.includes("A Tier: 90% chance, 1 item, 9 stock"));
assert.equal(compiled.assetManifest.packEconomics.pricePoints, 100);
assert.equal(compiled.assetManifest.packEconomics.drawRules.mode, "ONCE_PER_CUSTOMER");
assert.equal(compiled.assetManifest.packEconomics.tierOdds[0].percentage, 10);
assert.ok(compiled.prompt.includes("Horizontal mobile web banner, 3:2 ratio"));
assert.ok(compiled.prompt.includes("primary card"));
assert.ok(compiled.prompt.includes("Do not use PSA logos"));
assert.ok(compiled.claimWarnings.some((warning) => warning.fieldKey === "topLeftBadge"));
assert.ok(compiled.assetManifest.heroCards.some((card) => card.id === "p1" && card.primary));

const uploadCompiled = compileBannerTemplatePrompt(uploadFirstPayload, pack);
assert.ok(uploadCompiled.prompt.includes("Vendor uploaded chase card"));
assert.equal(uploadCompiled.assetManifest.heroCards[0].source, "upload");
assert.equal(uploadCompiled.assetManifest.heroCards[0].id, "source_upload_1");

const templateAsset = createBannerTemplateDraftAsset(pack, templatePayload, compiled);
assert.equal(templateAsset.width, 1500);
assert.equal(templateAsset.height, 1000);
assert.equal(templateAsset.targetUrl, `/packs/${pack.id}`);
assert.equal(templateAsset.metadata.renderer, "oripa-banner-template-mvp-manual-render");
assert.equal(templateAsset.metadata.templateId, "jp_arcade_guaranteed_hit_v1");
assert.ok(templateAsset.imageUrl.includes(encodeURIComponent("GUARANTEED HIT MYSTERY PACK")));

const manualPayload = {
  candidates: [
    {
      imageUrl: "http://localhost:4000/creative-storage/private/creative-jobs/job_1/rendered-banner-01.png",
      title: "GPT Image 2 candidate 1",
      width: 1536,
      height: 1024,
      notes: "best text readability",
    },
  ],
};
const manualSchemaResult = createManualCreativeCandidatesSchema.safeParse(manualPayload);
assert.equal(manualSchemaResult.success, true);
const unsafeManualSchemaResult = createManualCreativeCandidatesSchema.safeParse({
  candidates: [{ ...manualPayload.candidates[0], imageUrl: "https://images.example.test/rendered-banner-01.png" }],
});
assert.equal(unsafeManualSchemaResult.success, false);
const manualCandidate = createManualCreativeCandidateAsset({
  creativeJobId: "job_1",
  vendorId: "vendor_1",
  packId: pack.id,
  candidate: manualPayload.candidates[0],
  candidateIndex: 1,
  actorUserId: "user_1",
});
assert.equal(manualCandidate.title, "GPT Image 2 candidate 1");
assert.equal(manualCandidate.imageUrl, "http://localhost:4000/creative-storage/private/creative-jobs/job_1/rendered-banner-01.png");
assert.equal(manualCandidate.width, 1536);
assert.equal(manualCandidate.height, 1024);
assert.equal(manualCandidate.metadata.providerMode, "manual_gpt_image_2");
assert.equal(manualCandidate.metadata.reviewStatus, "PENDING_REVIEW");
assert.equal(manualCandidate.targetUrl, `/packs/${pack.id}`);

const generationRequest = buildGptImage2GenerationRequest({
  creativeJobId: "job_1",
  prompt: uploadCompiled.prompt,
  negativePrompt: uploadCompiled.negativePrompt,
  heroCards: uploadCompiled.assetManifest.heroCards,
});
assert.equal(generationRequest.model, "gpt-image-2");
assert.equal(generationRequest.images.length, 1);
assert.ok(generationRequest.prompt.includes("Vendor uploaded chase card"));
const generationSchemaResult = createGptImage2CreativeGenerationSchema.safeParse({ imageCount: 2 });
assert.equal(generationSchemaResult.success, true);
const providerCandidate = createProviderGeneratedCreativeCandidateAsset({
  creativeJobId: "job_1",
  vendorId: "vendor_1",
  packId: pack.id,
  imageUrl: "http://localhost:4000/creative-storage/private/creative-jobs/job_1/generated.png",
  contentHash: "c".repeat(64),
  width: 1536,
  height: 1024,
  promptHash: generationRequest.promptHash,
  providerRequestId: "req_123",
  candidateIndex: 1,
});
assert.equal(providerCandidate.metadata.providerMode, "direct_gpt_image_2");
assert.equal(providerCandidate.metadata.reviewStatus, "PENDING_REVIEW");

const approveSchemaResult = reviewCreativeAssetSchema.safeParse({ reviewStatus: "APPROVED_PRIVATE", reviewNotes: "ship this visual" });
assert.equal(approveSchemaResult.success, true);
const reviewedMetadata = markCreativeCandidateReviewed(manualCandidate.metadata, "APPROVED_PRIVATE", "ship this visual", "user_1");
assert.equal(reviewedMetadata.reviewStatus, "APPROVED_PRIVATE");
assert.equal(reviewedMetadata.reviewNotes, "ship this visual");
assert.equal(reviewedMetadata.reviewedByUserId, "user_1");

async function testCreativeStorage() {
  const tempCreativeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oripa-creative-storage-"));
  const tinyPng = await sharp({ create: { width: 32, height: 24, channels: 4, background: { r: 255, g: 80, b: 0, alpha: 1 } } }).png().toBuffer();
  const persistedCandidate = await persistCreativeCandidateImage({
    fileBuffer: tinyPng,
    originalName: "candidate.png",
    mimeType: "image/png",
    creativeJobId: "job_1",
    vendorId: "vendor_1",
    storageRoot: tempCreativeRoot,
    publicBaseUrl: "http://localhost:4000",
  });
  assert.equal(persistedCandidate.width, 32);
  assert.equal(persistedCandidate.height, 24);
  assert.equal(persistedCandidate.format, "png");
  assert.equal(persistedCandidate.bytesUploaded, tinyPng.length);
  assert.equal(persistedCandidate.relativeUrl.startsWith("/creative-storage/private/creative-jobs/job_1/"), true);
  assert.equal(persistedCandidate.publicUrl.startsWith("http://localhost:4000/creative-storage/private/creative-jobs/job_1/"), true);
  assert.equal(persistedCandidate.contentHash.length, 64);
  await fs.access(persistedCandidate.absolutePath);

  const cachedCard = await persistCardImageCache({
    fileBuffer: tinyPng,
    sourceImageUrl: "https://cards.example.test/charizard.png",
    packId: "pack_1",
    packPrizeId: "prize_1",
    vendorId: "vendor_1",
    label: "Charizard ex",
    storageRoot: tempCreativeRoot,
    publicBaseUrl: "http://localhost:4000",
  });
  assert.equal(cachedCard.relativeUrl.startsWith("/creative-storage/private/card-assets/pack-prizes/pack_1/prize_1/"), true);
  assert.equal(cachedCard.publicUrl.startsWith("http://localhost:4000/creative-storage/private/card-assets/pack-prizes/pack_1/prize_1/"), true);
  assert.equal(cachedCard.label, "Charizard ex");
  await fs.access(cachedCard.absolutePath);
  const readBackCard = await readCachedCardImage({ packId: "pack_1", packPrizeId: "prize_1", storageRoot: tempCreativeRoot, publicBaseUrl: "http://localhost:4000" });
  assert.equal(readBackCard?.contentHash, cachedCard.contentHash);
  assert.equal(readBackCard?.publicUrl, cachedCard.publicUrl);
  assert.equal(isUnsafeCreativeRemoteAddress("::ffff:127.0.0.1"), true);
  assert.equal(isUnsafeCreativeRemoteAddress("::ffff:7f00:1"), true);
  assert.equal(isUnsafeCreativeRemoteAddress("::ffff:ac10:1"), true);
  assert.equal(isUnsafeCreativeRemoteAddress("::ffff:c0a8:101"), true);
  assert.equal(isUnsafeCreativeRemoteAddress("2001:4860:4860::8888"), false);
  await assert.rejects(
    () => fetchAndPersistCardImage({
      sourceImageUrl: "http://127.0.0.1/internal-card.png",
      packId: "pack_1",
      packPrizeId: "prize_2",
      vendorId: "vendor_1",
      storageRoot: tempCreativeRoot,
    }),
    /private-network|localhost/,
  );

  const sourceAsset = await persistVendorSourceImage({
    fileBuffer: tinyPng,
    originalName: "vendor-card.png",
    mimeType: "image/png",
    vendorId: "vendor_1",
    storageRoot: tempCreativeRoot,
    publicBaseUrl: "http://localhost:4000",
  });
  assert.equal(sourceAsset.relativeUrl.startsWith("/creative-storage/private/source-assets/vendor_1/"), true);
  assert.equal(sourceAsset.publicUrl.startsWith("http://localhost:4000/creative-storage/private/source-assets/vendor_1/"), true);
  assert.equal(sourceAsset.source, "upload");
  assert.equal(sourceAsset.contentHash.length, 64);
  assert.equal(sourceAsset.snapshotHash.length, 64);
  await fs.access(sourceAsset.absolutePath);

  const handoffDir = path.join(tempCreativeRoot, "private", "hermes-handoffs", "job_1", "handoff_1");
  await fs.mkdir(handoffDir, { recursive: true });
  await fs.writeFile(path.join(handoffDir, "source-1.png"), tinyPng);
  await fs.writeFile(path.join(handoffDir, "oracle-banner.png"), tinyPng);
  await fs.writeFile(path.join(handoffDir, "notes.txt"), "not an image");
  const outputs = await findHermesHandoffOutputImages({
    creativeJobId: "job_1",
    handoffId: "handoff_1",
    storageRoot: tempCreativeRoot,
  });
  assert.deepEqual(outputs.map((output) => output.fileName), ["oracle-banner.png"]);
  assert.equal(outputs[0].absolutePath, path.join(handoffDir, "oracle-banner.png"));
  assert.equal(outputs[0].bytesUploaded, tinyPng.length);

  await fs.rm(tempCreativeRoot, { recursive: true, force: true });
}

void testCreativeStorage().then(() => {
  console.log("creative MVP service guardrails passed", {
    prompt,
    forbiddenTerms: forbidden.length,
    contentHash: assetA.contentHash,
  });
});

import assert from "node:assert/strict";
import {
  assertPromptSafe,
  buildForbiddenTerms,
  buildPrivateDraftAsset,
  buildSafeCreativePrompt,
  snapshotPackForCreative,
  snapshotPrizesForCreative,
} from "../src/modules/creative/service";

const pack = {
  id: "cmvpcreativepack001",
  title: "Charizard Chase Pack",
  status: "DRAFT",
  pricePoints: 100,
  totalStock: 10,
  remainingStock: 10,
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

const prizeSnapshot = snapshotPrizesForCreative(pack);
assert.equal(prizeSnapshot.length, 2);
assert.equal(prizeSnapshot[0].catalogItemId, "catalog-1");
assert.equal(prizeSnapshot[0].label, "Charizard ex Special Illustration Rare");

const assetA = buildPrivateDraftAsset(pack, "premium_foil");
const assetB = buildPrivateDraftAsset(pack, "premium_foil");
assert.equal(assetA.contentHash, assetB.contentHash);
assert.equal(assetA.targetUrl, `/packs/${pack.id}`);
assert.match(assetA.imageUrl, /^data:image\/svg\+xml;utf8,/);
assert.ok(assetA.imageUrl.includes(encodeURIComponent("Charizard ex Special Illustration Rare")));
assert.equal(assetA.metadata.aiProvider, "none_mock_background_only");

console.log("creative MVP service guardrails passed", {
  prompt,
  forbiddenTerms: forbidden.length,
  contentHash: assetA.contentHash,
});

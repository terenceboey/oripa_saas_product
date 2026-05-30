import assert from "node:assert/strict";
import {
  PackTemplateEditError,
  buildPackCreateDataFromTemplateVersion,
  buildTemplateSlotSnapshotRows,
  assertTemplateVersionSlotsEditable,
  type PackTemplateVersionForPublish,
} from "../src/modules/packs/templates";
import { computePoolSnapshotHash } from "../src/modules/packs/pool-snapshot";

const now = new Date("2026-05-30T13:00:00.000Z");

const templateVersion: PackTemplateVersionForPublish = {
  id: "tplv-1",
  templateId: "tpl-1",
  vendorId: "vendor-a",
  title: "Pokemon 151 Chase Pack",
  pricePoints: 1200,
  totalStock: 3,
  isNew: true,
  limitedLabel: "151 Drop",
  importantNotes: "Frozen from template v1",
  drawLimitMode: "NONE",
  drawLimitValue: null,
  drawLimitResetTimezone: "Asia/Singapore",
  startsAt: null,
  endsAt: null,
  slots: [
    {
      id: "slot-zard",
      sortOrder: 20,
      label: "Charizard ex",
      imageUrl: "https://images.example/zard-thumb.png",
      imageLargeUrl: "https://images.example/zard-large.png",
      setId: "sv3pt5",
      setName: "Scarlet & Violet 151",
      localId: "006",
      cardNumber: "006/165",
      rarity: "Double Rare",
      catalogItemId: "catalog-zard",
      catalogSource: "pokemoncard.io",
      catalogSourceItemId: "sv3pt5-006",
      catalogSnapshot: {
        sourceItemId: "sv3pt5-006",
        source: "pokemoncard.io",
        name: "Charizard ex",
      },
      estimatedValue: 2500,
      weight: 10,
      stock: 1,
    },
    {
      id: "slot-pika",
      sortOrder: 10,
      label: "Base Set Pikachu",
      imageUrl: "https://images.example/pika-thumb.png",
      imageLargeUrl: "https://images.example/pika-large.png",
      setId: "base1",
      setName: "Base Set",
      localId: "058",
      cardNumber: "58/102",
      rarity: "Common",
      catalogItemId: "catalog-pika",
      catalogSource: "tcgdex",
      catalogSourceItemId: "base1-058",
      catalogSnapshot: {
        name: "Pikachu",
        sourceItemId: "base1-058",
        source: "tcgdex",
      },
      estimatedValue: 300,
      weight: 25,
      stock: 2,
    },
  ],
};

const snapshotRows = buildTemplateSlotSnapshotRows(templateVersion);
assert.deepEqual(
  snapshotRows.map((row) => ({ id: row.id, label: row.label, remainingStock: row.remainingStock })),
  [
    { id: "slot-pika", label: "Base Set Pikachu", remainingStock: 2 },
    { id: "slot-zard", label: "Charizard ex", remainingStock: 1 },
  ],
  "template slots must publish into deterministic prize rows ordered by slot sortOrder/id with full remaining stock"
);

const publishData = buildPackCreateDataFromTemplateVersion(templateVersion, {
  actorUserId: "user-owner",
  now,
  idempotencyKey: "tpl-publish-1",
});

assert.equal(publishData.vendorId, "vendor-a");
assert.equal(publishData.title, "Pokemon 151 Chase Pack");
assert.equal(publishData.status, "LIVE");
assert.equal(publishData.sourceTemplateType, "VENDOR_TEMPLATE");
assert.equal(publishData.sourceTemplateId, "tpl-1");
assert.equal(publishData.sourceTemplateVersionId, "tplv-1");
assert.equal(publishData.publishedByUserId, "user-owner");
assert.equal(publishData.publishedFromTemplateAt, now);
assert.equal(publishData.publishIdempotencyKey, "tpl-publish-1");
assert.equal(publishData.remainingStock, 3);
assert.match(publishData.poolSnapshotHash, /^[a-f0-9]{64}$/);
assert.equal(
  publishData.poolSnapshotHash,
  computePoolSnapshotHash(snapshotRows),
  "published template pack pool hash must cover immutable prize snapshots"
);
assert.deepEqual(
  publishData.prizes.createMany.data.map((row) => ({
    label: row.label,
    stock: row.stock,
    remainingStock: row.remainingStock,
    catalogItemId: row.catalogItemId,
    catalogSnapshot: row.catalogSnapshot,
  })),
  [
    {
      label: "Base Set Pikachu",
      stock: 2,
      remainingStock: 2,
      catalogItemId: "catalog-pika",
      catalogSnapshot: {
        name: "Pikachu",
        sourceItemId: "base1-058",
        source: "tcgdex",
      },
    },
    {
      label: "Charizard ex",
      stock: 1,
      remainingStock: 1,
      catalogItemId: "catalog-zard",
      catalogSnapshot: {
        sourceItemId: "sv3pt5-006",
        source: "pokemoncard.io",
        name: "Charizard ex",
      },
    },
  ],
  "published PackPrize rows must be immutable snapshots copied from template version slots"
);

const editedTemplateVersion: PackTemplateVersionForPublish = {
  ...templateVersion,
  title: "Edited draft template title",
  slots: templateVersion.slots.map((slot) =>
    slot.id === "slot-zard"
      ? { ...slot, label: "Edited Charizard Label", stock: 99, estimatedValue: 1, catalogSnapshot: { edited: true } }
      : slot
  ),
};

assert.notEqual(
  computePoolSnapshotHash(buildTemplateSlotSnapshotRows(editedTemplateVersion)),
  publishData.poolSnapshotHash,
  "editing a later template version would produce a different hash, not mutate the already published pack hash"
);
assert.equal(
  publishData.prizes.createMany.data.find((row) => row.catalogItemId === "catalog-zard")?.label,
  "Charizard ex",
  "editing template slots after publish must not mutate already built PackPrize snapshot data"
);
assert.equal(
  publishData.prizes.createMany.data.find((row) => row.catalogItemId === "catalog-zard")?.stock,
  1,
  "editing template stock after publish must not mutate already built PackPrize stock"
);

assert.throws(
  () => assertTemplateVersionSlotsEditable({ status: "PUBLISHED" }),
  (error: unknown) => error instanceof PackTemplateEditError && error.reason === "immutable_version",
  "published template versions must reject slot edits so live pack snapshots stay immutable"
);

assert.throws(
  () => buildPackCreateDataFromTemplateVersion({ ...templateVersion, slots: [] }, { actorUserId: "user-owner", now }),
  /Template version cannot be published without slots/,
  "template versions with no slots must not publish empty live packs"
);

console.log("pack template publish tests passed");

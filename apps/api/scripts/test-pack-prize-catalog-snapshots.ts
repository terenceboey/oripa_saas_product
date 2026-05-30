import assert from "node:assert/strict";
import { createPackSchema } from "../../../packages/shared/src";
import {
  CatalogPrizeResolutionError,
  buildCatalogPrizeSnapshot,
  resolvePackPrizeRows,
  type CatalogItemSnapshotSource,
} from "../src/modules/packs/prize-snapshots";

const catalogCharizard: CatalogItemSnapshotSource = {
  id: "catalog-charizard",
  source: "pokemoncard.io",
  sourceItemId: "sv3pt5-006",
  itemType: "CARD",
  game: "POKEMON",
  language: "en",
  name: "Charizard ex",
  setId: "sv3pt5",
  setName: "Scarlet & Violet 151",
  localId: "006",
  cardNumber: "006/165",
  rarity: "Double Rare",
  imageBaseUrl: "https://images.example/charizard-base.png",
  imageThumbUrl: "https://images.example/charizard-thumb.png",
  imageLargeUrl: "https://images.example/charizard-large.png",
};

const catalogPikachu: CatalogItemSnapshotSource = {
  id: "catalog-pikachu",
  source: "tcgdex",
  sourceItemId: "base1-058",
  itemType: "CARD",
  game: "POKEMON",
  language: "en",
  name: "Pikachu",
  setId: "base1",
  setName: "Base Set",
  localId: "058",
  cardNumber: "58/102",
  rarity: "Common",
  imageBaseUrl: "https://images.example/pikachu-base.png",
  imageThumbUrl: null,
  imageLargeUrl: "https://images.example/pikachu-large.png",
};

const catalogById = new Map([
  [catalogCharizard.id, catalogCharizard],
  [catalogPikachu.id, catalogPikachu],
]);

const catalogStore = {
  async findCatalogItemsByIds(ids: string[]) {
    return ids.flatMap((id) => {
      const item = catalogById.get(id);
      return item ? [item] : [];
    });
  },
  async findCatalogItemBySourceRef(ref: { source: string; sourceItemId: string; language?: string }) {
    return [...catalogById.values()].find(
      (item) =>
        item.source === ref.source &&
        item.sourceItemId === ref.sourceItemId &&
        item.language === (ref.language ?? "en")
    ) ?? null;
  },
};

const parsedCatalogPayload = createPackSchema.safeParse({
  title: "Catalog Pack",
  pricePoints: 100,
  totalStock: 10,
  prizes: [
    {
      catalogItemId: catalogCharizard.id,
      label: "Client-supplied fake Charizard label",
      imageUrl: "https://client.example/fake.png",
      estimatedValue: 2500,
      weight: 10,
      stock: 1,
    },
  ],
});
assert.equal(parsedCatalogPayload.success, true, "createPackSchema should accept catalog-backed prizes");
assert.equal(
  parsedCatalogPayload.success ? parsedCatalogPayload.data.prizes?.[0]?.catalogItemId : undefined,
  catalogCharizard.id,
  "createPackSchema should preserve catalogItemId instead of stripping it"
);

const snapshot = buildCatalogPrizeSnapshot(catalogCharizard);
assert.deepEqual(snapshot, {
  catalogItemId: "catalog-charizard",
  catalogSource: "pokemoncard.io",
  catalogSourceItemId: "sv3pt5-006",
  catalogSnapshot: {
    id: "catalog-charizard",
    source: "pokemoncard.io",
    sourceItemId: "sv3pt5-006",
    itemType: "CARD",
    game: "POKEMON",
    language: "en",
    name: "Charizard ex",
    setId: "sv3pt5",
    setName: "Scarlet & Violet 151",
    localId: "006",
    cardNumber: "006/165",
    rarity: "Double Rare",
    imageBaseUrl: "https://images.example/charizard-base.png",
    imageThumbUrl: "https://images.example/charizard-thumb.png",
    imageLargeUrl: "https://images.example/charizard-large.png",
  },
  label: "Charizard ex",
  imageUrl: "https://images.example/charizard-thumb.png",
  imageLargeUrl: "https://images.example/charizard-large.png",
  setId: "sv3pt5",
  setName: "Scarlet & Violet 151",
  localId: "006",
  cardNumber: "006/165",
  rarity: "Double Rare",
});

async function main() {
  const catalogRows = await resolvePackPrizeRows(
    {
      prizes: [
        {
          catalogItemId: catalogCharizard.id,
          label: "Client-supplied fake Charizard label",
          imageUrl: "https://client.example/fake.png",
          estimatedValue: 2500,
          weight: 10,
          stock: 1,
        },
      ],
    },
    catalogStore
  );
  assert.equal(catalogRows.length, 1);
  assert.equal(catalogRows[0].label, "Charizard ex", "catalog snapshot label must come from authoritative CatalogItem");
  assert.equal(catalogRows[0].imageUrl, "https://images.example/charizard-thumb.png");
  assert.equal(catalogRows[0].catalogItemId, catalogCharizard.id);
  assert.equal(catalogRows[0].catalogSource, "pokemoncard.io");
  assert.equal(catalogRows[0].catalogSourceItemId, "sv3pt5-006");
  assert.equal(catalogRows[0].estimatedValue, 2500, "vendor value remains pack-specific");
  assert.equal(catalogRows[0].remainingStock, 1);
  assert.deepEqual(catalogRows[0].catalogSnapshot, snapshot.catalogSnapshot);

  const manualRows = await resolvePackPrizeRows(
    {
      prizes: [
        {
          label: "Manual mystery slab",
          imageUrl: "https://client.example/manual.png",
          estimatedValue: 5000,
          weight: 4,
          stock: 2,
        },
      ],
    },
    catalogStore
  );
  assert.deepEqual(manualRows[0], {
    label: "Manual mystery slab",
    imageUrl: "https://client.example/manual.png",
    weight: 4,
    stock: 2,
    remainingStock: 2,
    estimatedValue: 5000,
  });

  const tierRows = await resolvePackPrizeRows(
    {
      tiers: [
        {
          name: "A Tier",
          percentage: 10,
          items: [
            {
              catalogSource: "tcgdex",
              catalogSourceItemId: "base1-058",
              language: "en",
              label: "Fake tier label",
              estimatedValue: 300,
              stock: 3,
            },
          ],
        },
      ],
    },
    catalogStore
  );
  assert.equal(tierRows[0].label, "A Tier - Pikachu");
  assert.equal(tierRows[0].catalogItemId, catalogPikachu.id);
  assert.equal(tierRows[0].cardNumber, "58/102");
  assert.equal(tierRows[0].imageUrl, "https://images.example/pikachu-base.png");
  assert.equal(tierRows[0].weight, 1000);

  await assert.rejects(
    () =>
      resolvePackPrizeRows(
        {
          prizes: [
            {
              catalogItemId: "missing-catalog-id",
              label: "Missing",
              estimatedValue: 100,
              weight: 1,
              stock: 1,
            },
          ],
        },
        catalogStore
      ),
    (error) => error instanceof CatalogPrizeResolutionError && /Catalog item not found: missing-catalog-id/.test(error.message)
  );

  console.log("pack prize catalog snapshot tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

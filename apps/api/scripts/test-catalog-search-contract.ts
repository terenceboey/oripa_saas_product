import assert from "node:assert/strict";
import { findCatalogSearchAdapterCandidates } from "../src/modules/catalog/search-adapters";
import { collapseCatalogSearchItems } from "../src/modules/catalog/search-dedupe";

async function main() {
  const mockClient = {
    $queryRaw: async () => [
      {
        id: "card-1",
        entityType: "catalog_item",
        catalogClass: "CARD",
        prizeableNow: true,
        source: "tcgtracking",
        sourceItemId: "111",
        itemType: "CARD",
        game: "POKEMON",
        language: "en",
        name: "Charizard ex",
        setId: "sv3pt5",
        setName: "Scarlet & Violet 151",
        localId: "006",
        cardNumber: "006/165",
        rarity: "Double Rare",
        imageThumbUrl: "thumb.jpg",
        imageLargeUrl: "large.jpg",
        imageBaseUrl: "base.jpg",
        searchText: "charizard ex",
      },
    ],
    catalogSealedProduct: {
      findMany: async () => [
        {
          id: "sealed-1",
          source: "tcgtracking",
          sourceProductId: "222",
          catalogSetId: "set-db-1",
          game: "POKEMON",
          language: "en",
          name: "151 Booster Bundle",
          imageUrl: "sealed.jpg",
          searchText: "151 booster bundle",
          catalogSet: { sourceSetId: "sv3pt5", name: "Scarlet & Violet 151" },
        },
      ],
    },
    catalogSet: {
      findMany: async () => [
        {
          id: "set-1",
          source: "tcgtracking",
          sourceSetId: "sv3pt5",
          game: "POKEMON",
          setCode: "MEW",
          name: "Scarlet & Violet 151",
          logoImageUrl: "logo.png",
          symbolImageUrl: "symbol.png",
          bannerImageUrl: "banner.png",
          searchText: "scarlet violet 151",
        },
      ],
    },
  };

  const cards = collapseCatalogSearchItems(
    await findCatalogSearchAdapterCandidates(mockClient as any, { q: "char", game: "POKEMON", itemClass: "CARD" }, 5),
  );
  assert.equal(cards[0].entityType, "catalog_item");
  assert.equal(cards[0].catalogClass, "CARD");
  assert.equal(cards[0].prizeableNow, true);

  const sealed = collapseCatalogSearchItems(
    await findCatalogSearchAdapterCandidates(mockClient as any, { q: "151", game: "POKEMON", itemClass: "SEALED_PRODUCT" }, 5),
  );
  assert.equal(sealed[0].entityType, "catalog_sealed_product");
  assert.equal(sealed[0].catalogClass, "SEALED_PRODUCT");
  assert.equal(sealed[0].prizeableNow, true);
  assert.equal("vendorId" in sealed[0], false, "catalog search must not leak owned inventory fields");

  const sets = collapseCatalogSearchItems(
    await findCatalogSearchAdapterCandidates(mockClient as any, { q: "151", game: "POKEMON", itemClass: "SET" }, 5),
  );
  assert.equal(sets[0].entityType, "catalog_set");
  assert.equal(sets[0].catalogClass, "SET");
  assert.equal(sets[0].prizeableNow, false);

  const all = collapseCatalogSearchItems(
    await findCatalogSearchAdapterCandidates(mockClient as any, { q: "151", game: "POKEMON", itemClass: "ALL" }, 10),
  );
  assert.deepEqual(
    all.map((item) => [item.entityType, item.catalogClass, item.prizeableNow]),
    [
      ["catalog_item", "CARD", true],
      ["catalog_sealed_product", "SEALED_PRODUCT", true],
      ["catalog_set", "SET", false],
    ],
  );

  console.log("catalog search contract tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import assert from "node:assert/strict";
import {
  findCatalogSearchAdapterCandidates,
  normalizeCatalogSearchClass,
} from "../src/modules/catalog/search-adapters";

async function main() {
  assert.equal(normalizeCatalogSearchClass({}), "CARD");
  assert.equal(normalizeCatalogSearchClass({ type: "sealed" }), "SEALED_PRODUCT");
  assert.equal(normalizeCatalogSearchClass({ itemClass: "SET" }), "SET");
  assert.equal(normalizeCatalogSearchClass({ type: "sealed", itemClass: "SEALED_PRODUCT" }), "SEALED_PRODUCT");
  assert.throws(() => normalizeCatalogSearchClass({ type: "sealed", itemClass: "CARD" }), /type and itemClass conflict/);

  let lastCardSql = "";
  const mockClient = {
    $queryRaw: async (sql: any) => {
      lastCardSql = Array.isArray(sql?.strings) ? sql.strings.join("?") : "";
      return [
      {
        id: "card-1",
        source: "tcgtracking",
        sourceItemId: "111",
        itemType: "CARD",
        game: "POKEMON",
        language: "en",
        name: "Charizard ex",
        setId: "sv3pt5",
        setName: "151",
        localId: "006",
        cardNumber: "006/165",
        rarity: "Double Rare",
        imageThumbUrl: "thumb.jpg",
        imageLargeUrl: "large.jpg",
        imageBaseUrl: "base.jpg",
        searchText: "charizard ex",
      },
    ];
    },
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

  const sealed = await findCatalogSearchAdapterCandidates(
    mockClient as any,
    { q: "151", game: "POKEMON", itemClass: "SEALED_PRODUCT" },
    5,
  );
  assert.equal(sealed[0].itemType, "SEALED_PRODUCT");
  assert.equal(sealed[0].sourceItemId, "222");
  assert.equal(sealed[0].setId, "sv3pt5");
  assert.equal(sealed[0].imageThumbUrl, "sealed.jpg");
  assert.equal("vendorId" in sealed[0], false);
  assert.equal("grade" in sealed[0], false);
  assert.equal("certNumberMasked" in sealed[0], false);

  const sets = await findCatalogSearchAdapterCandidates(mockClient as any, { q: "151", game: "POKEMON", itemClass: "SET" }, 5);
  assert.equal(sets[0].itemType, "SET");
  assert.equal(sets[0].sourceItemId, "sv3pt5");
  assert.equal(sets[0].imageThumbUrl, "logo.png");
  assert.equal(sets[0].setName, "Scarlet & Violet 151");

  const slabs = await findCatalogSearchAdapterCandidates(mockClient as any, { q: "char", game: "POKEMON", itemClass: "SLAB" }, 5);
  assert.deepEqual(slabs, []);

  await findCatalogSearchAdapterCandidates(mockClient as any, { q: "char", game: "ALL", itemClass: "CARD" }, 5);
  assert.equal(lastCardSql.includes("game ="), false);
  assert.equal(lastCardSql.includes('JOIN "CatalogSet" cs'), true);

  console.log("catalog search adapter tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

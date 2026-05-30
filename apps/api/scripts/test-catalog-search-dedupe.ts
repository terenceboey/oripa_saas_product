import assert from "node:assert/strict";
import {
  collapseCatalogSearchItems,
  getCatalogSearchTcgplayerProductId,
} from "../src/modules/catalog/search-dedupe";

const base = {
  id: "base",
  sourceItemId: "base-source-id",
  itemType: "CARD",
  game: "POKEMON",
  language: "en",
  name: "Charizard",
  setId: "sv3pt5",
  setName: "Scarlet & Violet 151",
  localId: "006",
  cardNumber: "006",
  rarity: "Rare",
  imageThumbUrl: null,
  imageLargeUrl: null,
  imageBaseUrl: null,
};

assert.equal(
  getCatalogSearchTcgplayerProductId({
    source: "tcgtracking",
    sourcePayload: { raw: { id: 12345 } },
  }),
  "12345",
);

assert.equal(
  getCatalogSearchTcgplayerProductId({
    source: "pokemoncard.io",
    sourcePayload: { raw: { tcgplayer_id: "12345" } },
  }),
  "12345",
);

assert.equal(
  getCatalogSearchTcgplayerProductId({
    source: "onepiecedb.io",
    sourcePayload: { raw: { tcgplayer_product_id: 999 } },
  }),
  "999",
);

const collapsedPokemon = collapseCatalogSearchItems([
  {
    ...base,
    id: "tcg-charizard",
    source: "tcgtracking",
    sourceItemId: "12345",
    sourcePayload: { raw: { id: 12345 } },
  },
  {
    ...base,
    id: "pcio-charizard",
    source: "pokemoncard.io",
    sourceItemId: "sv3pt5-006",
    sourcePayload: { raw: { tcgplayer_id: "12345" } },
  },
]);

assert.equal(collapsedPokemon.length, 1);
assert.equal(collapsedPokemon[0].id, "pcio-charizard");
assert.deepEqual(collapsedPokemon[0].mergedSourceItems, [
  { id: "tcg-charizard", source: "tcgtracking", sourceItemId: "12345" },
]);

const collapsedOnePiece = collapseCatalogSearchItems([
  {
    ...base,
    game: "ONE_PIECE",
    id: "tcg-luffy",
    source: "tcgtracking",
    sourceItemId: "888",
    sourcePayload: { raw: { id: "888" } },
  },
  {
    ...base,
    game: "ONE_PIECE",
    id: "opdb-luffy",
    source: "onepiecedb.io",
    sourceItemId: "op01-001",
    sourcePayload: { raw: { tcgplayer_product_id: "888" } },
  },
]);

assert.equal(collapsedOnePiece.length, 1);
assert.equal(collapsedOnePiece[0].id, "opdb-luffy");
assert.deepEqual(collapsedOnePiece[0].mergedSourceItems, [
  { id: "tcg-luffy", source: "tcgtracking", sourceItemId: "888" },
]);

const noIdRows = collapseCatalogSearchItems([
  {
    ...base,
    id: "tcg-no-id",
    source: "tcgtracking",
    sourceItemId: "no-id-a",
    sourcePayload: { raw: { id: "" } },
  },
  {
    ...base,
    id: "pcio-no-id",
    source: "pokemoncard.io",
    sourceItemId: "no-id-b",
    sourcePayload: { raw: {} },
  },
]);

assert.equal(noIdRows.length, 2);

console.log("catalog search dedupe tests passed");

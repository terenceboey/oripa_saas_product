import assert from "node:assert/strict";
import {
  buildCatalogFacetWhere,
  buildCatalogSuggestWhere,
  toCatalogFacetResponse,
  toCatalogSuggestionResponse,
} from "../src/modules/catalog/facets";

const activePokemonCardWhere = buildCatalogFacetWhere({
  game: "POKEMON",
  type: "card",
  language: "en",
  source: "pokemoncard.io",
  setId: "sv3pt5",
  rarity: "Rare",
});

assert.equal(activePokemonCardWhere.isActive, true);
assert.equal(activePokemonCardWhere.game, "POKEMON");
assert.equal(activePokemonCardWhere.itemType, "CARD");
assert.equal(activePokemonCardWhere.language, "en");
assert.equal(activePokemonCardWhere.source, "pokemoncard.io");
assert.equal(activePokemonCardWhere.setId, "sv3pt5");
assert.deepEqual(activePokemonCardWhere.rarity, { contains: "Rare", mode: "insensitive" });

const suggestWhere = buildCatalogSuggestWhere({ q: "char", game: "POKEMON", type: "all", language: "en" });
assert.equal(suggestWhere.isActive, true);
assert.equal(suggestWhere.game, "POKEMON");
assert.equal(suggestWhere.language, "en");
assert.equal(suggestWhere.itemType, undefined);
assert.deepEqual(suggestWhere.OR, [
  { name: { startsWith: "char", mode: "insensitive" } },
  { name: { contains: "char", mode: "insensitive" } },
  { searchText: { contains: "char", mode: "insensitive" } },
]);

const facetResponse = toCatalogFacetResponse([
  { source: "pokemoncard.io", language: "en", setId: "sv3pt5", setName: "Scarlet & Violet 151", rarity: "Rare" },
  { source: "tcgtracking", language: "en", setId: "sv3pt5", setName: "Scarlet & Violet 151", rarity: "Rare" },
  { source: "pokemoncard.io", language: "ja", setId: "sv2a", setName: "Pokemon Card 151", rarity: "Double Rare" },
  { source: "pokemoncard.io", language: "en", setId: null, setName: null, rarity: null },
]);

assert.deepEqual(facetResponse.sources, [
  { value: "pokemoncard.io", count: 3 },
  { value: "tcgtracking", count: 1 },
]);
assert.deepEqual(facetResponse.languages, [
  { value: "en", count: 3 },
  { value: "ja", count: 1 },
]);
assert.deepEqual(facetResponse.sets[0], { id: "sv3pt5", name: "Scarlet & Violet 151", count: 2 });
assert.equal(facetResponse.rarities[0].value, "Rare");

const suggestionResponse = toCatalogSuggestionResponse([
  {
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
    imageThumbUrl: "https://img/thumb.png",
    imageLargeUrl: "https://img/large.png",
    imageBaseUrl: "https://img/base.png",
    searchText: "charizard ex sv3pt5 006",
    sourcePayload: { raw: { shouldNotLeak: true } },
  },
]);

assert.deepEqual(Object.keys(suggestionResponse.items[0]).sort(), [
  "cardNumber",
  "game",
  "id",
  "imageBaseUrl",
  "imageLargeUrl",
  "imageThumbUrl",
  "itemType",
  "language",
  "localId",
  "name",
  "rarity",
  "setId",
  "setName",
  "source",
  "sourceItemId",
].sort());
assert.equal(suggestionResponse.items[0].id, "catalog-charizard");
assert.equal("sourcePayload" in suggestionResponse.items[0], false);
assert.equal("searchText" in suggestionResponse.items[0], false);

console.log("catalog facets/suggest tests passed");

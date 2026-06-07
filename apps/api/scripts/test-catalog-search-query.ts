import assert from "node:assert/strict";
import {
  attachCatalogSearchPayloads,
  buildCatalogIndexedSearchSql,
  buildCatalogSearchWhere,
  rankCatalogSearchItem,
  sortCatalogSearchCandidates,
  stripCatalogSearchPayload,
} from "../src/modules/catalog/search-query";

const base = {
  id: "base",
  source: "tcgtracking",
  sourceItemId: "base-source-id",
  itemType: "CARD",
  game: "POKEMON",
  language: "en",
  name: "Charizard ex",
  setId: "sv3pt5",
  setName: "Scarlet & Violet 151",
  localId: "006",
  cardNumber: "006/165",
  rarity: "Double Rare",
  imageThumbUrl: null,
  imageLargeUrl: null,
  imageBaseUrl: null,
  sourcePayload: { raw: { id: 12345, huge: "payload" } },
};

const where = buildCatalogSearchWhere({
  q: "zard",
  game: "POKEMON",
  typeFilter: "CARD",
  language: "en",
  source: "tcgtracking",
  setId: "sv3pt5",
  setName: "151",
  rarity: "rare",
  localId: "006",
  cardNumber: "006/165",
});

assert.equal(where.isActive, true);
assert.equal(where.game, "POKEMON");
assert.equal(where.itemType, "CARD");
assert.equal(where.language, "en");
assert.equal(where.source, "tcgtracking");
assert.deepEqual(where.catalogSet, {
  sourceSetId: "sv3pt5",
  name: { contains: "151", mode: "insensitive" },
});
assert.deepEqual(where.rarity, { contains: "rare", mode: "insensitive" });
assert.equal(where.localId, "006");
assert.equal(where.cardNumber, "006/165");
assert.deepEqual(where.OR, [
  { name: { startsWith: "zard", mode: "insensitive" } },
  { name: { contains: "zard", mode: "insensitive" } },
  { searchText: { contains: "zard", mode: "insensitive" } },
]);

const indexedSql = buildCatalogIndexedSearchSql(
  {
    q: "zard",
    game: "POKEMON",
    typeFilter: "CARD",
    language: "en",
    source: "tcgtracking",
    setId: "sv3pt5",
    setName: "151",
    rarity: "rare",
    localId: "006",
    cardNumber: "006/165",
  },
  40,
);
const indexedSqlText = indexedSql.strings.join("?");
assert.match(indexedSqlText, /lower\(ci\.name\) LIKE/);
assert.match(indexedSqlText, /JOIN "CatalogSet" cs/);
assert.match(indexedSqlText, /cs\."sourceSetId" =/);
assert.doesNotMatch(indexedSqlText, /"searchText"\s+ILIKE/i);
assert.equal(indexedSql.values.includes("%zard%"), true);

const ranked = sortCatalogSearchCandidates("char", [
  { ...base, id: "searchText", name: "Fire Lizard", searchText: "char fire lizard" },
  { ...base, id: "contains", name: "Mega Charizard", searchText: "mega charizard" },
  { ...base, id: "starts", name: "Charizard", searchText: "charizard" },
]);
assert.deepEqual(ranked.map((item) => item.id), ["starts", "contains", "searchText"]);
assert.equal(rankCatalogSearchItem("char", { name: "Charizard", searchText: "charizard" }), 0);
assert.equal(rankCatalogSearchItem("char", { name: "Mega Charizard", searchText: "mega charizard" }), 1);
assert.equal(rankCatalogSearchItem("saur", { name: "Ivyshell", searchText: "grass saur starter" }), 2);

const payloadAttached = attachCatalogSearchPayloads([{ ...base, sourcePayload: undefined }], [
  { id: "base", sourcePayload: { raw: { tcgplayer_id: "12345" } } },
]);
assert.deepEqual(payloadAttached[0].sourcePayload, { raw: { tcgplayer_id: "12345" } });

const responseItem = stripCatalogSearchPayload({ ...base, searchText: "charizard sv3pt5" });
assert.equal("sourcePayload" in responseItem, false);
assert.equal("searchText" in responseItem, false);
assert.equal(responseItem.localId, "006");

console.log("catalog search query tests passed");

import assert from "node:assert/strict";
import {
  buildSetSearchText,
  buildTcgtrackingSetCandidate,
  classifyReviewStatus,
  inferGroupKind,
  inferTcgtrackingSourceSetId,
} from "./remediate-live-db-missing-gaps";

assert.equal(inferTcgtrackingSourceSetId("3", "2765"), "2765");
assert.equal(inferTcgtrackingSourceSetId("68", "17675"), "68:17675");
assert.equal(inferTcgtrackingSourceSetId("85", "24423"), "85:24423");
assert.equal(inferTcgtrackingSourceSetId(null, "1938"), "1938");
assert.equal(inferTcgtrackingSourceSetId("68", null), null);

assert.equal(inferGroupKind({ name: "One Piece Promotion Cards", abbreviation: "OP-PR" }), "promo");
assert.equal(inferGroupKind({ name: "Starter Deck: Red Edward", abbreviation: "ST-01" }), "starter_deck");
assert.equal(inferGroupKind({ name: "Trick or Trade BOOster Bundle 2024" }), "seasonal_collection");
assert.equal(inferGroupKind({ name: "Attack of the Vine!", isSupplemental: false }), "main_expansion");

assert.equal(classifyReviewStatus({ source: "tcgtracking", sourcePayload: { raw: {} }, groupKind: "promo" }), "auto_classified");
assert.equal(classifyReviewStatus({ source: "tcgtracking", sourcePayload: { raw: {} }, groupKind: null }), "source_backed_needs_review");
assert.equal(classifyReviewStatus({ source: "pokemoncard.io", sourcePayload: null, groupKind: null }), "legacy_metadata_only_needs_review");

const onePieceCandidate = buildTcgtrackingSetCandidate({
  game: "ONE_PIECE",
  language: "en",
  setId: "17675",
  setName: "One Piece Promotion Cards",
  sourcePayload: {
    source: "tcgtracking",
    sourceCategoryId: "68",
    rawSourceItemId: "634531",
    set: {
      id: 17675,
      name: "One Piece Promotion Cards",
      abbreviation: "OP-PR",
      published_on: "2022-09-30",
      product_count: 1310,
      set_symbol_url: null,
      is_supplemental: false,
    },
  },
});
assert.ok(onePieceCandidate);
assert.equal(onePieceCandidate?.sourceSetId, "68:17675");
assert.equal(onePieceCandidate?.sourceCategoryId, "68");
assert.equal(onePieceCandidate?.rawSourceSetId, "17675");
assert.equal(onePieceCandidate?.name, "One Piece Promotion Cards");
assert.equal(onePieceCandidate?.setCode, "OP-PR");
assert.equal(onePieceCandidate?.groupKind, "promo");
assert.equal(onePieceCandidate?.productCount, 1310);
assert.equal(onePieceCandidate?.searchText, "one piece promotion cards op-pr one_piece en tcgtracking");
assert.equal((onePieceCandidate?.sourcePayload as Record<string, unknown>).derivedFrom, "CatalogItem.sourcePayload.set");
assert.equal((onePieceCandidate?.sourcePayload as Record<string, unknown>).__oripaPayloadTrust, "source_backed");
assert.deepEqual((onePieceCandidate?.sourcePayload as any).__oripaPayloadProvenance, {
  importer: "remediate-live-db-missing-gaps",
  derivedFrom: "CatalogItem.sourcePayload.set",
  source: "tcgtracking",
});

const pokemonCandidate = buildTcgtrackingSetCandidate({
  game: "POKEMON",
  language: "en",
  setId: "2765",
  setName: "SWSH05: Battle Styles",
  sourcePayload: {
    source: "tcgtracking",
    categoryId: "3",
    set: {
      id: 2765,
      name: "SWSH05: Battle Styles",
      abbreviation: "SWSH05",
      published_on: "2021-03-19",
      product_count: 232,
      set_symbol_url: "https://tcgtracking.com/scan/set-symbol.php?game=3&set=SWSH05",
    },
  },
});
assert.ok(pokemonCandidate);
assert.equal(pokemonCandidate?.sourceSetId, "2765");
assert.equal(pokemonCandidate?.symbolImageUrl, "https://tcgtracking.com/scan/set-symbol.php?game=3&set=SWSH05");
assert.equal(pokemonCandidate?.groupKind, "main_expansion");

assert.equal(
  buildSetSearchText(["SWSH05: Battle Styles", "SWSH05", "POKEMON", "en", "tcgtracking"]),
  "swsh05: battle styles swsh05 pokemon en tcgtracking",
);

assert.equal(
  buildTcgtrackingSetCandidate({ game: "ONE_PIECE", language: "en", setId: null, setName: null, sourcePayload: { sourceCategoryId: "68" } }),
  null,
);

console.log("live DB remediation helper tests passed");

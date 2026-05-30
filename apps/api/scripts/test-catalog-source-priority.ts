import assert from "node:assert/strict";
import { getSourceRank } from "../src/modules/catalog/source-priority";

assert.deepEqual(
  getSourceRank({ game: "POKEMON", itemClass: "SET", source: "tcgtracking", useCase: "SET_IMAGERY" }),
  { displayRank: 0, collapseEligible: true },
);

assert.equal(
  getSourceRank({ game: "POKEMON", itemClass: "SET", source: "bulbapedia", useCase: "SET_IMAGERY" }).displayRank >
    getSourceRank({ game: "POKEMON", itemClass: "SET", source: "tcgtracking", useCase: "SET_IMAGERY" }).displayRank,
  true,
);

assert.deepEqual(
  getSourceRank({ game: "POKEMON", itemClass: "CARD", source: "pokemoncard.io", useCase: "SEARCH_DISPLAY" }),
  { displayRank: 0, collapseEligible: true },
);

assert.deepEqual(
  getSourceRank({ game: "ONE_PIECE", itemClass: "CARD", source: "onepiecedb.io", useCase: "SEARCH_DISPLAY" }),
  { displayRank: 0, collapseEligible: true },
);

assert.deepEqual(
  getSourceRank({ game: "POKEMON", itemClass: "CARD", source: "mystery-source", useCase: "SEARCH_DISPLAY" }),
  { displayRank: 50, collapseEligible: false },
);

assert.deepEqual(
  getSourceRank({ game: "POKEMON", itemClass: "SLAB", source: "tcgtracking", useCase: "SEARCH_DISPLAY" }),
  { displayRank: 1000, collapseEligible: false },
);

console.log("catalog source priority tests passed");

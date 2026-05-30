import assert from "node:assert/strict";
import {
  buildExternalCardSearchText,
  normalizeBulbapediaExpansionSet,
  normalizeOnePieceDbCardForCatalog,
  normalizeOnePieceDbSetFromCard,
  normalizePokemonCardIoCardForCatalog,
  normalizePokemonCardIoSetFromCard,
  slugifySourceSetId,
} from "../src/modules/catalog/card-db-sources-normalizer";

const pokemon = {
  id: "basep-24",
  name: "_____'s Pikachu",
  number: 24,
  rarity: "Promo",
  setName: "Wizards Black Star Promos",
  setCode: "basep",
  cardnumber: "24",
  releaseDate: "1999-07-01T00:00:00.000000Z",
  locale: "eng",
  image_url: "https://images.pokemoncard.io/images/basep/basep-24.png",
  high_res_image_url: "https://images.pokemoncard.io/images/basep/basep-24_hires.png",
  supertype: "Pokémon",
  subtype: "Basic",
  types: "Lightning",
  artist: "Kagemaru Himeno",
};

assert.deepEqual(normalizePokemonCardIoCardForCatalog(pokemon), {
  source: "pokemoncard.io",
  sourceItemId: "basep-24",
  localId: "24",
  itemType: "CARD",
  game: "POKEMON",
  language: "en",
  name: "_____'s Pikachu",
  setId: "basep",
  setName: "Wizards Black Star Promos",
  cardNumber: "24",
  rarity: "Promo",
  imageBaseUrl: "https://images.pokemoncard.io/images/basep/basep-24.png",
  imageThumbUrl: "https://images.pokemoncard.io/images/basep/basep-24.png",
  imageLargeUrl: "https://images.pokemoncard.io/images/basep/basep-24_hires.png",
  searchText: "_____'s pikachu wizards black star promos basep 24 promo pokemon card pokemoncard.io pokémon basic lightning kagemaru himeno",
  isActive: true,
  sourcePayload: { source: "pokemoncard.io", raw: pokemon },
});

assert.deepEqual(normalizePokemonCardIoSetFromCard(pokemon), {
  source: "pokemoncard.io",
  sourceSetId: "basep",
  game: "POKEMON",
  setCode: "basep",
  name: "Wizards Black Star Promos",
  releaseDate: new Date("1999-07-01T00:00:00.000000Z"),
  productCount: null,
  symbolImageUrl: null,
  logoImageUrl: null,
  bannerImageUrl: null,
  isSupplemental: false,
  searchText: "wizards black star promos basep pokemon set pokemoncard.io",
  isActive: true,
});

const onePiece = {
  id: "EB01-050",
  name: "...I Want to Live!!",
  number: "50",
  printed_number: "EB01-050",
  type: "Event",
  color1: "Black",
  subtype1: "Straw Hat Crew",
  rarity: "Common",
  rarity_code: "C",
  rules: "[Counter] If you have 30 or more cards in your trash...",
  setName: "Memorial Collection",
  setCode: "EB01",
  releaseDate: "2024-05-03T00:00:00.000000Z",
  language_code: "EN",
  image_url: "https://images.onepiecedb.io/images/EB01/EB01-050.png",
  high_res_image_url: "https://images.onepiecedb.io/images/EB01/EB01-050_hiresopt.jpg",
  card_number: "EB01-050",
};

assert.equal(normalizeOnePieceDbCardForCatalog(onePiece)?.searchText.includes("one_piece card onepiecedb.io event black"), true);
assert.equal(normalizeOnePieceDbCardForCatalog(onePiece)?.game, "ONE_PIECE");
assert.equal(normalizeOnePieceDbCardForCatalog(onePiece)?.setId, "EB01");
assert.equal(normalizeOnePieceDbSetFromCard(onePiece)?.name, "Memorial Collection");

assert.equal(slugifySourceSetId("Scarlet & Violet—151 (TCG)"), "scarlet-violet-151-tcg");
assert.equal(normalizeBulbapediaExpansionSet({ name: "Scarlet & Violet—151", releaseDate: new Date("2023-09-22") })?.source, "bulbapedia");

assert.equal(
  buildExternalCardSearchText({ name: "Nami", setName: "Romance Dawn", setCode: "OP01", cardNumber: "OP01-016", rarity: "Rare", game: "ONE_PIECE", source: "onepiecedb.io" }),
  "nami romance dawn op01 op01-016 rare one_piece card onepiecedb.io",
);

assert.equal(normalizePokemonCardIoCardForCatalog({ id: "x" }), null);
assert.equal(normalizeOnePieceDbCardForCatalog({ name: "x" }), null);

console.log("carddb source normalizer tests passed");

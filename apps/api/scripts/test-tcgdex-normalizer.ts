import assert from "node:assert/strict";
import { normalizeTcgdexCardForCatalog, buildTcgdexSearchText } from "../src/modules/catalog/tcgdex-normalizer";

const card = {
  id: "sv01-001",
  localId: "001",
  name: "Pineco",
  image: "https://assets.tcgdex.net/en/sv/sv01/001",
  category: "Pokemon",
  rarity: "Common",
  illustrator: "Shigenori Negishi",
  set: {
    id: "sv01",
    name: "Scarlet & Violet",
  },
  variants: {
    normal: true,
    reverse: true,
    holo: false,
    firstEdition: false,
  },
};

const row = normalizeTcgdexCardForCatalog(card, { language: "en" });

assert.deepEqual(row, {
  source: "tcgdex",
  sourceItemId: "sv01-001",
  localId: "001",
  itemType: "CARD",
  game: "POKEMON",
  language: "en",
  name: "Pineco",
  setId: "sv01",
  setName: "Scarlet & Violet",
  cardNumber: "001",
  rarity: "Common",
  imageBaseUrl: "https://assets.tcgdex.net/en/sv/sv01/001",
  imageThumbUrl: "https://assets.tcgdex.net/en/sv/sv01/001/low.webp",
  imageLargeUrl: "https://assets.tcgdex.net/en/sv/sv01/001/high.webp",
  searchText: "pineco scarlet & violet sv01 001 common pokemon shigenori negishi pokemon card tcgdex",
  isActive: true,
  sourcePayload: card,
});

assert.equal(
  buildTcgdexSearchText({
    name: "Charizard ex",
    setName: "Obsidian Flames",
    setId: "sv03",
    localId: "125",
    rarity: "Double rare",
    category: "Pokemon",
    illustrator: "5ban Graphics",
  }),
  "charizard ex obsidian flames sv03 125 double rare pokemon 5ban graphics pokemon card tcgdex",
);

assert.equal(normalizeTcgdexCardForCatalog({ id: "bad" }, { language: "en" }), null);

console.log("tcgdex normalizer tests passed");

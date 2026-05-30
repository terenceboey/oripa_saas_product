import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildTcgtrackingSearchText,
  mergeNormalizeStats,
  normalizeTcgtrackingProductForCatalog,
  type NormalizeStats,
} from "../src/modules/catalog/tcgtracking-normalizer";

function readJson<T>(relativePath: string): T {
  const filePath = path.resolve(__dirname, "..", relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

type SetFixture = {
  set_id: number;
  set_name: string;
  set_abbr: string;
  products: Array<Record<string, unknown>>;
};

const setFixture = readJson<SetFixture>("src/modules/catalog/fixtures/tcgtracking/category-3/3_sets_1938.json");
const detailFixture = readJson<Record<string, unknown>>("src/modules/catalog/fixtures/tcgtracking/category-3/products_180514.json");

const sample = normalizeTcgtrackingProductForCatalog(setFixture.products[1] ?? {}, {
  language: "en",
  categoryId: "3",
  set: {
    set_id: setFixture.set_id,
    set_name: setFixture.set_name,
    set_abbr: setFixture.set_abbr,
  },
  sourceContext: { fixture: "3_sets_1938.json" },
});

assert.ok(sample.row, "expected fixture sample row to normalize");
assert.equal(sample.row?.source, "tcgtracking");
assert.equal(sample.row?.sourceItemId, "180514");
assert.equal(sample.row?.itemType, "CARD");
assert.equal(sample.row?.game, "POKEMON");
assert.equal(sample.row?.localId, "002a/131");
assert.equal(sample.row?.cardNumber, "002a/131");
assert.equal(sample.row?.setId, "1938");
assert.equal(sample.row?.setName, "Alternate Art Promos");
assert.equal(sample.row?.imageThumbUrl, "https://tcgplayer-cdn.tcgplayer.com/product/180514_200w.jpg");
assert.match(sample.row?.searchText ?? "", /tcgtracking/);
assert.match(sample.row?.searchText ?? "", /alternate art promos/);
assert.equal((sample.row?.sourcePayload as Record<string, unknown>).source, "tcgtracking");
assert.equal(
  ((sample.row?.sourcePayload as Record<string, unknown>).raw as Record<string, unknown>).id,
  180514,
);

const missingId = normalizeTcgtrackingProductForCatalog({ name: "No id" }, { language: "en" });
assert.equal(missingId.row, null);
assert.equal(missingId.stats.missing_id, 1);

const missingName = normalizeTcgtrackingProductForCatalog({ id: 123 }, { language: "en" });
assert.equal(missingName.row, null);
assert.equal(missingName.stats.missing_name, 1);

const missingCollectorAllowed = normalizeTcgtrackingProductForCatalog(
  { id: 222, name: "Card without number", rarity: "Promo", image_url: null },
  { language: "en", set: { id: "x" } },
);
assert.ok(missingCollectorAllowed.row);
assert.equal(missingCollectorAllowed.row?.localId, null);
assert.equal(missingCollectorAllowed.row?.cardNumber, null);
assert.equal(missingCollectorAllowed.stats.missing_image, 1);

const nonCardSkipped = normalizeTcgtrackingProductForCatalog(
  { id: 333, name: "Sealed Box", number: null, rarity: null, cardtrader: [{ product_type: "sealed" }] },
  { language: "en" },
);
assert.equal(nonCardSkipped.row, null);
assert.equal(nonCardSkipped.stats.non_card_product, 1);

const fixtureResults = setFixture.products.map((product) =>
  normalizeTcgtrackingProductForCatalog(product, {
    language: "en",
    categoryId: "3",
    set: {
      set_id: setFixture.set_id,
      set_name: setFixture.set_name,
      set_abbr: setFixture.set_abbr,
    },
  }),
);

const fixtureStats = mergeNormalizeStats(fixtureResults.map((x) => x.stats));
assert.ok(fixtureStats.rows_written > 0);
assert.ok(fixtureStats.rows_skipped > 0);
assert.equal(fixtureStats.rows_written + fixtureStats.rows_skipped, setFixture.products.length);

const detailProduct = (detailFixture.product ?? {}) as Record<string, unknown>;
const detailRow = normalizeTcgtrackingProductForCatalog(detailProduct, {
  language: "en",
  categoryId: "3",
  set: {
    id: detailProduct.group_id,
    set_name: detailProduct.set_name,
    set_abbr: detailProduct.set_abbr,
  },
  pricing: detailFixture.prices,
  skus: detailFixture.skus,
});
assert.ok(detailRow.row);
assert.equal(detailRow.row?.sourceItemId, "180514");
assert.equal(detailRow.row?.setId, "1938");

assert.equal(
  buildTcgtrackingSearchText({
    name: "Charizard ex",
    setName: "Obsidian Flames",
    setId: "sv03",
    setAbbr: "OBF",
    cardNumber: "125/197",
    rarity: "Double Rare",
  }),
  "charizard ex obsidian flames sv03 obf 125/197 double rare pokemon card tcgtracking",
);

assert.equal(
  buildTcgtrackingSearchText({
    name: "Lightning Bolt",
    setName: "Magic Player Rewards",
    setId: "MPR",
    setAbbr: "MPR",
    cardNumber: "30",
    rarity: "Rare",
    game: "MAGIC",
  }),
  "lightning bolt magic player rewards mpr mpr 30 rare magic card tcgtracking",
);

const magicRow = normalizeTcgtrackingProductForCatalog(
  { id: 999, name: "Lightning Bolt", number: "30", rarity: "Rare", image_url: "https://example.test/bolt.jpg" },
  { language: "en", game: "MAGIC", categoryId: "1", set: { id: "mpr", name: "Magic Player Rewards", abbreviation: "MPR" } },
);
assert.ok(magicRow.row);
assert.equal(magicRow.row?.sourceItemId, "1:999");
assert.equal(magicRow.row?.game, "MAGIC");
assert.match(magicRow.row?.searchText ?? "", /magic card tcgtracking/);
assert.doesNotMatch(magicRow.row?.searchText ?? "", /pokemon/);

const expectedKeys: Array<keyof NormalizeStats> = [
  "missing_id",
  "missing_name",
  "missing_image",
  "missing_set_metadata",
  "non_card_product",
  "rows_written",
  "rows_skipped",
];
for (const key of expectedKeys) {
  assert.equal(typeof fixtureStats[key], "number", `expected numeric stats key ${key}`);
}

console.log("tcgtracking normalizer tests passed");

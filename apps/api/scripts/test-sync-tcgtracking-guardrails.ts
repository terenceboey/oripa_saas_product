import assert from "node:assert/strict";

function mustThrow(fn: () => unknown, expected: RegExp) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    assert.match(String(error), expected);
  }
  assert.equal(threw, true, `expected throw matching ${expected}`);
}

async function main() {
  process.env.TCGTRACKING_SYNC_TEST_MODE = "1";
  const syncModule = await import("./sync-tcgtracking");

  const {
    buildRuntimeConfig,
    getApprovedTcgtrackingCategory,
    ensureWriteAllowed,
    validateSmokePayload,
    buildSyncSummaryLine,
  } = syncModule;

  const dryRunDefault = buildRuntimeConfig({
    TCGTRACKING_DB_ENV: "local",
    DATABASE_URL: "postgres://localhost/oripa",
  });
  assert.equal(dryRunDefault.dryRun, true);
  assert.equal(dryRunDefault.maxSets, 0);
  assert.equal(dryRunDefault.allowFixtureFallback, false);

  mustThrow(
    () =>
      buildRuntimeConfig({
        TCGTRACKING_DB_ENV: "local",
        DATABASE_URL: "postgresql://oregon-postgres.render.com/oripa",
      }),
    /Render DATABASE_URL cannot be used with TCGTRACKING_DB_ENV=local/,
  );

  mustThrow(
    () =>
      buildRuntimeConfig({
        TCGTRACKING_DRY_RUN: "false",
        DATABASE_URL: "postgres://localhost/oripa",
      }),
    /TCGTRACKING_DB_ENV must be explicitly set for non-dry-run execution/,
  );

  const magicCategory = getApprovedTcgtrackingCategory("1");
  assert.equal(magicCategory.game, "MAGIC");
  assert.equal(magicCategory.language, "en");

  const onePieceCategory = getApprovedTcgtrackingCategory("68");
  assert.equal(onePieceCategory.game, "ONE_PIECE");
  assert.equal(onePieceCategory.language, "en");

  const lorcanaCategory = getApprovedTcgtrackingCategory("71");
  assert.equal(lorcanaCategory.game, "LORCANA");
  assert.equal(lorcanaCategory.language, "en");

  const riftboundCategory = getApprovedTcgtrackingCategory("89");
  assert.equal(riftboundCategory.game, "RIFTBOUND");
  assert.equal(riftboundCategory.language, "en");

  for (const [categoryId, game] of Object.entries({
    "17": "FORCE_OF_WILL",
    "24": "FINAL_FANTASY",
    "25": "UNIVERSUS",
    "63": "DIGIMON",
    "66": "METAZOO",
    "67": "WIXOSS",
    "72": "BATTLE_SPIRITS_SAGA",
    "73": "SHADOWVERSE_EVOLVE",
    "74": "GRAND_ARCHIVE",
    "75": "AKORA",
    "76": "KRYPTIK",
    "77": "SORCERY_CONTESTED_REALM",
    "78": "ALPHA_CLASH",
    "79": "STAR_WARS_UNLIMITED",
    "80": "DRAGON_BALL_SUPER_FUSION_WORLD",
    "81": "UNION_ARENA",
    "83": "ELESTRALS",
    "86": "GUNDAM",
    "87": "HOLOLIVE",
    "88": "GODZILLA",
  })) {
    const category = getApprovedTcgtrackingCategory(categoryId);
    assert.equal(category.game, game);
    assert.equal(category.language, "en");
  }

  const onePieceRuntimeCategory = buildRuntimeConfig({
    TCGTRACKING_DB_ENV: "local",
    TCGTRACKING_CATEGORY_ID: "68",
    DATABASE_URL: "postgres://localhost/oripa",
  });
  assert.equal(onePieceRuntimeCategory.categoryId, "68");
  assert.equal(onePieceRuntimeCategory.game, "ONE_PIECE");
  assert.equal(onePieceRuntimeCategory.language, "en");

  const pokemonJapanCategory = buildRuntimeConfig({
    TCGTRACKING_DB_ENV: "local",
    TCGTRACKING_CATEGORY_ID: "85",
    DATABASE_URL: "postgres://localhost/oripa",
  });
  assert.equal(pokemonJapanCategory.categoryId, "85");
  assert.equal(pokemonJapanCategory.game, "POKEMON");
  assert.equal(pokemonJapanCategory.language, "ja");

  mustThrow(
    () =>
      buildRuntimeConfig({
        TCGTRACKING_DB_ENV: "local",
        TCGTRACKING_CATEGORY_ID: "999999",
      }),
    /Unsupported TCGTracking category 999999/,
  );

  const productionWritesBlocked = buildRuntimeConfig({
    TCGTRACKING_DB_ENV: "production",
    TCGTRACKING_DRY_RUN: "false",
    TCGTRACKING_ALLOW_LIVE_WRITE: "false",
    DATABASE_URL: "postgres://prod/oripa",
  });
  mustThrow(() => ensureWriteAllowed(productionWritesBlocked), /TCGTRACKING_ALLOW_LIVE_WRITE=true/);

  const localWritesAllowed = buildRuntimeConfig({
    TCGTRACKING_DB_ENV: "local",
    TCGTRACKING_DRY_RUN: "false",
    DATABASE_URL: "postgres://localhost/oripa",
  });
  ensureWriteAllowed(localWritesAllowed);

  const smokeConfig = {
    ...dryRunDefault,
    dryRun: false,
    dbEnv: "staging" as const,
  };

  mustThrow(
    () => validateSmokePayload({ status: 403, contentType: "text/html", url: "https://x", payload: "<html></html>" }, smokeConfig),
    /status=403/,
  );
  mustThrow(
    () => validateSmokePayload({ status: 200, contentType: "text/html", url: "https://x", payload: "<html>cf</html>" }, smokeConfig),
    /non-JSON\/Cloudflare\/html response/,
  );
  mustThrow(
    () => validateSmokePayload({ status: 200, contentType: "application/json", url: "https://x", payload: {} }, smokeConfig),
    /empty or missing expected keys/,
  );

  const setListSmokeOk = validateSmokePayload(
    {
      status: 200,
      contentType: "application/json",
      url: "https://tcgtracking.com/tcgapi/v1/3/sets",
      payload: { category_id: 3, category_name: "Pokemon", sets: [{ id: 1938, name: "Paldean Fates" }] },
    },
    smokeConfig,
  );
  assert.equal(setListSmokeOk.ok, true);
  assert.equal(setListSmokeOk.productCount, 1);

  const productArraySmokeOk = validateSmokePayload(
    {
      status: 200,
      contentType: "application/json",
      url: "https://tcgtracking.com/tcgapi/v1/3/sets/1938",
      payload: [{ id: 1, name: "Card" }],
    },
    smokeConfig,
  );
  assert.equal(productArraySmokeOk.ok, true);
  assert.equal(productArraySmokeOk.productCount, 1);

  const summaryLine = buildSyncSummaryLine({
    sets: 1,
    cards: 10,
    normalized: 9,
    upserted: 0,
    failures: 1,
    durationSec: 2,
  });
  assert.match(summaryLine, /sets=1/);
  assert.match(summaryLine, /upserted=0/);

  console.log("tcgtracking sync guardrail tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export const setlistRouter = Router();

const gameMap: Record<string, string> = {
  pokemon: "POKEMON",
  onepiece: "ONE_PIECE",
  "one-piece": "ONE_PIECE",
  "pokemon-japan": "POKEMON_JAPAN",
  all: "ALL",
};

const listQuerySchema = z.object({
  game: z.string().trim().toLowerCase().optional().default("pokemon"),
  source: z.string().trim().toLowerCase().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(["newest", "oldest", "name"]).optional().default("newest"),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(60).optional().default(24),
});

const cardQuerySchema = z.object({
  source: z.string().trim().toLowerCase().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  rarity: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(120).optional().default(30),
});

function resolveGame(input: string) {
  return gameMap[input] ?? "POKEMON";
}

function setlistScopeWhere(game: string) {
  if (game === "ALL") return {};
  if (game === "POKEMON_JAPAN") {
    return {
      OR: [
        { game: "POKEMON_JAPAN" },
        { game: "POKEMON", language: "ja" },
      ],
    };
  }
  if (game === "POKEMON") return { game: "POKEMON", language: "en" };
  if (game === "ONE_PIECE") return { game: "ONE_PIECE", language: "en" };
  return { game };
}

function normalizeSource(input?: string | null) {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "pokemoncardio") return "pokemoncard.io";
  if (normalized === "onepiecedb") return "onepiecedb.io";
  return normalized;
}

function normalizeImageKey(input?: string | null) {
  return input?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? null;
}

const OFFICIAL_POKEMON_IMAGE_KEYS_BY_SET_NAME: Record<string, string[]> = {
  "aquapolis": ["ecard2"],
  "arceus": ["pl4"],
  "base set": ["base1"],
  "base set (shadowless)": ["base1"],
  "base set 2": ["base4"],
  "best of promos": ["bp"],
  "black and white": ["bw1"],
  "black and white promos": ["bwp"],
  "boundaries crossed": ["bw7"],
  "call of legends": ["col1"],
  "celebrations": ["cel25"],
  "celebrations: classic collection": ["cel25c"],
  "champion's path": ["swsh35"],
  "crystal guardians": ["ex14"],
  "dark explorers": ["bw5"],
  "delta species": ["ex11"],
  "deoxys": ["ex8"],
  "detective pikachu": ["det1"],
  "diamond and pearl": ["dp1"],
  "diamond and pearl promos": ["dpp"],
  "double crisis": ["dc1"],
  "dragon": ["ex3"],
  "dragon frontiers": ["ex15"],
  "dragon majesty": ["sm75"],
  "dragon vault": ["dv1"],
  "dragons exalted": ["bw6"],
  "emerald": ["ex9"],
  "emerging powers": ["bw2"],
  "ex trainer kit 1: latias & latios": ["tk1a"],
  "ex trainer kit 2: plusle & minun": ["tk2a"],
  "expedition": ["ecard1"],
  "firered & leafgreen": ["ex6"],
  "fossil": ["base3"],
  "generations": ["g1"],
  "generations: radiant collection": ["g1"],
  "great encounters": ["dp4"],
  "gym challenge": ["gym2"],
  "gym heroes": ["gym1"],
  "heartgold soulsilver": ["hgss1"],
  "hgss promos": ["hsp"],
  "hidden fates": ["sm115"],
  "hidden fates: shiny vault": ["sma"],
  "hidden legends": ["ex5"],
  "holon phantoms": ["ex13"],
  "jungle": ["base2"],
  "kalos starter set": ["xy0"],
  "legend maker": ["ex12"],
  "legendary collection": ["base6"],
  "legendary treasures": ["bw11"],
  "legendary treasures: radiant collection": ["bw11"],
  "legends awakened": ["dp6"],
  "majestic dawn": ["dp5"],
  "mcdonald's 25th anniversary promos": ["mcd21"],
  "mcdonald's promos 2011": ["mcd11"],
  "mcdonald's promos 2012": ["mcd12"],
  "mcdonald's promos 2014": ["mcd14"],
  "mcdonald's promos 2015": ["mcd15"],
  "mcdonald's promos 2016": ["mcd16"],
  "mcdonald's promos 2017": ["mcd17"],
  "mcdonald's promos 2018": ["mcd18"],
  "mcdonald's promos 2019": ["mcd19"],
  "mcdonald's promos 2022": ["mcd22"],
  "me: mega evolution promo": ["me1"],
  "mysterious treasures": ["dp2"],
  "neo destiny": ["neo4"],
  "neo discovery": ["neo2"],
  "neo genesis": ["neo1"],
  "neo revelation": ["neo3"],
  "next destinies": ["bw4"],
  "nintendo promos": ["np"],
  "noble victories": ["bw3"],
  "plasma blast": ["bw10"],
  "plasma freeze": ["bw9"],
  "plasma storm": ["bw8"],
  "platinum": ["pl1"],
  "pokemon go": ["pgo"],
  "pop series 1": ["pop1"],
  "pop series 2": ["pop2"],
  "pop series 3": ["pop3"],
  "pop series 4": ["pop4"],
  "pop series 5": ["pop5"],
  "pop series 6": ["pop6"],
  "pop series 7": ["pop7"],
  "pop series 8": ["pop8"],
  "pop series 9": ["pop9"],
  "power keepers": ["ex16"],
  "rising rivals": ["pl2"],
  "ruby and sapphire": ["ex1"],
  "rumble": ["ru1"],
  "sandstorm": ["ex2"],
  "secret wonders": ["dp3"],
  "shining fates": ["swsh45"],
  "shining fates: shiny vault": ["swsh45sv"],
  "shining legends": ["sm35"],
  "skyridge": ["ecard3"],
  "sm - burning shadows": ["sm3"],
  "sm - celestial storm": ["sm7"],
  "sm - cosmic eclipse": ["sm12"],
  "sm - crimson invasion": ["sm4"],
  "sm - forbidden light": ["sm6"],
  "sm - guardians rising": ["sm2"],
  "sm - lost thunder": ["sm8"],
  "sm - team up": ["sm9"],
  "sm - ultra prism": ["sm5"],
  "sm - unbroken bonds": ["sm10"],
  "sm - unified minds": ["sm11"],
  "sm base set": ["sm1"],
  "sm promos": ["smp"],
  "southern islands": ["si1"],
  "stormfront": ["dp7"],
  "supreme victors": ["pl3"],
  "sv: paldean fates": ["sv4pt5"],
  "sv: prismatic evolutions": ["sv8pt5"],
  "sv: scarlet & violet 151": ["sv3pt5"],
  "sv: scarlet & violet promo cards": ["svp"],
  "sv: shrouded fable": ["sv6pt5"],
  "sv01: scarlet & violet base set": ["sv1"],
  "sv02: paldea evolved": ["sv2"],
  "sv03: obsidian flames": ["sv3"],
  "sv04: paradox rift": ["sv4"],
  "sv05: temporal forces": ["sv5"],
  "sv06: twilight masquerade": ["sv6"],
  "sv07: stellar crown": ["sv7"],
  "sv08: surging sparks": ["sv8"],
  "sv09: journey together": ["sv9"],
  "sv10: destined rivals": ["sv10"],
  "sve: scarlet & violet energies": ["sve"],
  "swsh: crown zenith": ["swsh12pt5"],
  "swsh: crown zenith: galarian gallery": ["swsh12pt5gg"],
  "swsh: sword & shield promo cards": ["swshp"],
  "swsh01: sword & shield base set": ["swsh1"],
  "swsh02: rebel clash": ["swsh2"],
  "swsh03: darkness ablaze": ["swsh3"],
  "swsh04: vivid voltage": ["swsh4"],
  "swsh05: battle styles": ["swsh5"],
  "swsh06: chilling reign": ["swsh6"],
  "swsh07: evolving skies": ["swsh7"],
  "swsh08: fusion strike": ["swsh8"],
  "swsh09: brilliant stars": ["swsh9"],
  "swsh09: brilliant stars trainer gallery": ["swsh9tg"],
  "swsh10: astral radiance": ["swsh10"],
  "swsh10: astral radiance trainer gallery": ["swsh10tg"],
  "swsh11: lost origin": ["swsh11"],
  "swsh11: lost origin trainer gallery": ["swsh11tg"],
  "swsh12: silver tempest": ["swsh12"],
  "swsh12: silver tempest trainer gallery": ["swsh12tg"],
  "team magma vs team aqua": ["ex4"],
  "team rocket": ["base5"],
  "team rocket returns": ["ex7"],
  "triumphant": ["hgss4"],
  "undaunted": ["hgss3"],
  "unleashed": ["hgss2"],
  "unseen forces": ["ex10"],
  "wotc promo": ["basep"],
  "xy - ancient origins": ["xy7"],
  "xy - breakpoint": ["xy9"],
  "xy - breakthrough": ["xy8"],
  "xy - evolutions": ["xy12"],
  "xy - fates collide": ["xy10"],
  "xy - flashfire": ["xy2"],
  "xy - furious fists": ["xy3"],
  "xy - phantom forces": ["xy4"],
  "xy - primal clash": ["xy5"],
  "xy - roaring skies": ["xy6"],
  "xy - steam siege": ["xy11"],
  "xy base set": ["xy1"],
  "xy promos": ["xyp"],
  "xy trainer kit: latias & latios": ["tk1a"],
};

function cleanImageUrl(url?: string | null) {
  const trimmed = url?.trim();
  return trimmed || null;
}

function expectedOfficialPokemonImageKeys(setName?: string | null, setCode?: string | null) {
  const name = setName?.toLowerCase() ?? "";
  const keys = new Set<string>();
  const codeKey = normalizeImageKey(setCode);
  if (codeKey) keys.add(codeKey);

  for (const key of OFFICIAL_POKEMON_IMAGE_KEYS_BY_SET_NAME[name] ?? []) {
    keys.add(key);
  }

  const popMatch = name.match(/pop series (\d+)/);
  if (popMatch) keys.add(`pop${popMatch[1]}`);
  if (name.includes("pokemon go") || name.includes("pokémon go")) keys.add("pgo");
  if (name.includes("pokemon rumble") || name === "rumble") keys.add("ru1");
  if (name.includes("hidden fates") && name.includes("shiny vault")) keys.add("sma");
  if (name.includes("shining fates") && name.includes("shiny vault")) keys.add("swsh45sv");
  if (name.includes("nintendo") && name.includes("promos")) keys.add("np");
  if (name.includes("scarlet") && name.includes("violet") && name.includes("promo")) keys.add("svp");

  const trainerGallery = name.match(/swsh(\d+).*trainer gallery/);
  if (trainerGallery) keys.add(`swsh${Number(trainerGallery[1])}tg`);

  const swsh = name.match(/^swsh(\d+)/);
  if (swsh) keys.add(`swsh${Number(swsh[1])}`);
  const sv = name.match(/^sv0?(\d+)/);
  if (sv) keys.add(`sv${Number(sv[1])}`);
  const sm = setName?.match(/^SM(?: - | Base Set)/i) && setCode?.match(/^SM0?(\d+)$/i);
  if (sm) keys.add(`sm${Number(sm[1])}`);

  if (name.includes("crown zenith") && name.includes("galarian gallery")) keys.add("swsh12pt5gg");
  else if (name.includes("crown zenith")) keys.add("swsh12pt5");
  if (name.includes("paldean fates")) keys.add("sv4pt5");
  if (name.includes("shrouded fable")) keys.add("sv6pt5");
  if (name.includes("prismatic evolutions")) keys.add("sv8pt5");
  if (name.includes("mcdonald") && name.includes("25th")) keys.add("mcd21");
  const mcd = setName?.match(/McDonald's (?:Collection|Promos) (20\d\d)/i);
  if (mcd) keys.add(`mcd${mcd[1].slice(2)}`);
  if (name.includes("sm promos")) keys.add("smp");
  if (name.includes("xy promos")) keys.add("xyp");
  if (name.includes("black and white promos")) keys.add("bwp");
  if (name.includes("hgss promos")) keys.add("hsp");
  if (name.includes("diamond and pearl promos")) keys.add("dpp");
  if (name.includes("wotc promo")) keys.add("basep");
  if (name === "base set" || name.includes("base set shadowless")) keys.add("base1");
  if (name === "expedition") keys.add("ecard1");
  if (name.includes("best of promos")) keys.add("bp");
  if (name.includes("mega evolution promo")) keys.add("me1");
  if (name.includes("ex trainer kit 1") || name.includes("xy trainer kit latias")) keys.add("tk1a");
  if (name.includes("ex trainer kit 2")) keys.add("tk2a");

  return keys;
}


function usableBulbagardenSetLogo(url: string) {
  if (!/^https:\/\/archives\.bulbagarden\.net\/media\/upload\//i.test(url)) return false;
  const decoded = decodeURIComponent(url).toLowerCase();
  if (!/(?:logo|symbol|trick_or_trade(?:_2023|_2024)?)/i.test(decoded)) return false;
  if (/pokemon_tcg_logo|pokémon_tcg_logo|tcg_logo_old|tcg_logo\.png/.test(decoded)) return false;
  if (/pack|box|booster|constructed|key_visual|poster|anime|none\.png|card\d|temporalforces|masterball/.test(decoded)) return false;
  return /\.(?:png|jpg|jpeg|webp)(?:$|[/?#])/i.test(decoded);
}

function usableOnePieceProductVisual(url: string) {
  if (!/^https:\/\/en\.onepiece-cardgame\.com\//i.test(url)) return false;
  const lower = url.toLowerCase();
  if (!/(?:\/images\/products\/|\/renewal\/images\/products\/|\/onepiececg\/bccard\/|\/products\/boosters\/images\/)/.test(lower)) return false;
  if (/\/cardlist\/card\//.test(lower)) return false;
  if (/batch_[a-z0-9-]+\d|op\d{2}-\d{3}|st\d{2}-\d{3}|p-\d{3}/i.test(lower)) return false;
  return /(?:logo|mv_01|bg_mv|\/mv\.|img_item01|img_thumbnail)/i.test(lower) && /\.(?:png|jpg|jpeg|webp)(?:$|[?&#])/i.test(lower);
}

function usableSetImageUrl(url: string | null | undefined, setCode?: string | null, setName?: string | null) {
  const usable = cleanImageUrl(url);
  if (!usable) return null;

  // Known source-native set artwork CDNs. These are set/logo/symbol assets, not
  // product photos or card art.
  if (/^https:\/\/assets\.tcgdex\.net\//i.test(usable)) return usable;
  if (/^https:\/\/images\.scrydex\.com\/pokemon\//i.test(usable)) return usable;
  if (/^https:\/\/www\.pokemon\.com\/static-assets\/content-assets\/cms2\/img\/trading-card-game\//i.test(usable)) return usable;
  if (usableBulbagardenSetLogo(usable)) return usable;
  if (usableOnePieceProductVisual(usable)) return usable;

  // Official Pokémon TCG set images use only /<set-id>/logo.png or /<set-id>/symbol.png.
  // Card art under the same CDN uses card-number paths, so keep the suffix gate and require row evidence.
  const pokemonTcgMatch = usable.match(/^https:\/\/images\.pokemontcg\.io\/([^/]+)\/(?:logo|symbol)\.png$/i);
  if (pokemonTcgMatch) {
    const imageSetKey = normalizeImageKey(pokemonTcgMatch[1]);
    if (imageSetKey && expectedOfficialPokemonImageKeys(setName, setCode).has(imageSetKey)) return usable;
    return null;
  }

  return null;
}

async function resolveCatalogSetBySourceSetId(input: {
  sourceSetId: string;
  game: string;
  source?: string | null;
}) {
  const resolvedSource = normalizeSource(input.source);
  if (resolvedSource) {
    return prisma.catalogSet.findFirst({
      where: {
        sourceSetId: input.sourceSetId,
        ...setlistScopeWhere(input.game),
        source: resolvedSource,
        isActive: true,
      },
      select: {
        id: true,
        source: true,
        sourceSetId: true,
        name: true,
        setCode: true,
        game: true,
        releaseDate: true,
        symbolImageUrl: true,
        logoImageUrl: true,
        bannerImageUrl: true,
      },
    });
  }

  const matches = await prisma.catalogSet.findMany({
    where: {
      sourceSetId: input.sourceSetId,
      ...setlistScopeWhere(input.game),
      isActive: true,
    },
    orderBy: [{ source: "asc" }, { updatedAt: "desc" }],
    take: 2,
    select: {
      id: true,
      source: true,
      sourceSetId: true,
      name: true,
      setCode: true,
      game: true,
      releaseDate: true,
      symbolImageUrl: true,
      logoImageUrl: true,
      bannerImageUrl: true,
    },
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const error = new Error("AMBIGUOUS_SET_SOURCE");
    throw error;
  }
  return null;
}

setlistRouter.get("/v1/public/setlists", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { game, source, q, sort, page, limit } = parsed.data;
  const resolvedGame = resolveGame(game);
  const resolvedSource = normalizeSource(source);
  const skip = (page - 1) * limit;
  const search = q?.toLowerCase();
  const orderBy =
    sort === "name"
      ? [{ name: "asc" as const }]
      : sort === "oldest"
        ? [{ releaseDate: "asc" as const }, { name: "asc" as const }]
        : [{ releaseDate: "desc" as const }, { name: "asc" as const }];

  const where = {
    isActive: true,
    ...setlistScopeWhere(resolvedGame),
    ...(resolvedSource ? { source: resolvedSource } : {}),
    ...(search ? { searchText: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [total, sets] = await Promise.all([
    prisma.catalogSet.count({ where }),
    prisma.catalogSet.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        source: true,
        sourceSetId: true,
        game: true,
        setCode: true,
        name: true,
        releaseDate: true,
        productCount: true,
        symbolImageUrl: true,
        logoImageUrl: true,
        bannerImageUrl: true,
        _count: {
          select: {
            cards: { where: { isActive: true } },
            sealedProducts: { where: { isActive: true } },
          },
        },
      },
    }),
  ]);

  return res.json({
    game: resolvedGame,
    source: resolvedSource ?? null,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    items: sets.map((set) => ({
      resolvedLogoImageUrl: usableSetImageUrl(set.logoImageUrl, set.setCode, set.name),
      resolvedSymbolImageUrl: usableSetImageUrl(set.symbolImageUrl, set.setCode, set.name),
      resolvedBannerImageUrl: usableSetImageUrl(set.bannerImageUrl, set.setCode, set.name),
      id: set.id,
      source: set.source,
      sourceSetId: set.sourceSetId,
      game: set.game,
      setCode: set.setCode,
      name: set.name,
      releaseDate: set.releaseDate,
      productCount: set.productCount,
      cardCount: set._count.cards,
      sealedProductCount: set._count.sealedProducts,
      symbolImageUrl: usableSetImageUrl(set.symbolImageUrl, set.setCode, set.name),
      logoImageUrl: usableSetImageUrl(set.logoImageUrl, set.setCode, set.name),
      bannerImageUrl: usableSetImageUrl(set.bannerImageUrl, set.setCode, set.name),
    })),
  });
});

setlistRouter.get("/v1/public/setlists/:sourceSetId/cards", async (req, res) => {
  const parsed = cardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const sourceSetId = String(req.params.sourceSetId ?? "").trim();
  if (!sourceSetId) {
    return res.status(400).json({ error: "sourceSetId is required" });
  }

  const game = resolveGame(String(req.query.game ?? "pokemon").trim().toLowerCase());
  const source = normalizeSource(String(req.query.source ?? ""));
  const { q, rarity, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  let catalogSet = null;
  try {
    catalogSet = await resolveCatalogSetBySourceSetId({ sourceSetId, game, source });
  } catch (error) {
    if ((error as Error).message === "AMBIGUOUS_SET_SOURCE") {
      return res.status(409).json({
        error: "Set source is ambiguous. Please include ?source=<source> for this set.",
      });
    }
    throw error;
  }

  if (!catalogSet) {
    return res.status(404).json({ error: "Set not found" });
  }

  const where = {
    catalogSetId: catalogSet.id,
    itemType: "CARD" as const,
    isActive: true,
    ...(q ? { searchText: { contains: q.toLowerCase(), mode: "insensitive" as const } } : {}),
    ...(rarity ? { rarity: { equals: rarity, mode: "insensitive" as const } } : {}),
  };

  const [total, items, rarities] = await Promise.all([
    prisma.catalogItem.count({ where }),
    prisma.catalogItem.findMany({
      where,
      orderBy: [{ cardNumber: "asc" }, { name: "asc" }],
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        cardNumber: true,
        rarity: true,
        imageThumbUrl: true,
        imageLargeUrl: true,
        imageBaseUrl: true,
      },
    }),
    prisma.catalogItem.findMany({
      where: { catalogSetId: catalogSet.id, itemType: "CARD", isActive: true },
      distinct: ["rarity"],
      select: { rarity: true },
      orderBy: [{ rarity: "asc" }],
    }),
  ]);

  return res.json({
    set: {
      ...catalogSet,
      logoImageUrl: usableSetImageUrl(catalogSet.logoImageUrl, catalogSet.setCode, catalogSet.name),
      symbolImageUrl: usableSetImageUrl(catalogSet.symbolImageUrl, catalogSet.setCode, catalogSet.name),
      bannerImageUrl: usableSetImageUrl(catalogSet.bannerImageUrl, catalogSet.setCode, catalogSet.name),
    },
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    rarities: rarities.map((r) => r.rarity).filter(Boolean),
    items,
  });
});

setlistRouter.get("/v1/public/setlists/:sourceSetId/sealed", async (req, res) => {
  const sourceSetId = String(req.params.sourceSetId ?? "").trim();
  if (!sourceSetId) {
    return res.status(400).json({ error: "sourceSetId is required" });
  }
  const game = resolveGame(String(req.query.game ?? "pokemon").trim().toLowerCase());
  const source = normalizeSource(String(req.query.source ?? ""));

  let setRecord = null;
  try {
    setRecord = await resolveCatalogSetBySourceSetId({ sourceSetId, game, source });
  } catch (error) {
    if ((error as Error).message === "AMBIGUOUS_SET_SOURCE") {
      return res.status(409).json({
        error: "Set source is ambiguous. Please include ?source=<source> for this set.",
      });
    }
    throw error;
  }
  if (!setRecord) {
    return res.status(404).json({ error: "Set not found" });
  }

  const sealed = await prisma.catalogSealedProduct.findMany({
    where: {
      catalogSetId: setRecord.id,
      isActive: true,
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      cleanName: true,
      imageUrl: true,
      imageCount: true,
      isPresale: true,
      presaleReleaseDate: true,
    },
  });

  const setPayload = {
    id: setRecord.id,
    source: setRecord.source,
    sourceSetId: setRecord.sourceSetId,
    name: setRecord.name,
    game: setRecord.game,
  };

  return res.json({
    set: setPayload,
    items: sealed,
  });
});

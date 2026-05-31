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

function normalizeSource(input?: string | null) {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "pokemoncardio") return "pokemoncard.io";
  if (normalized === "onepiecedb") return "onepiecedb.io";
  return normalized;
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
        ...(input.game !== "ALL" ? { game: input.game } : {}),
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
        cards: {
          where: { isActive: true, itemType: "CARD" },
          take: 1,
          orderBy: [{ cardNumber: "asc" }, { name: "asc" }],
          select: {
            imageThumbUrl: true,
            imageLargeUrl: true,
            imageBaseUrl: true,
          },
        },
      },
    });
  }

  const matches = await prisma.catalogSet.findMany({
    where: {
      sourceSetId: input.sourceSetId,
      ...(input.game !== "ALL" ? { game: input.game } : {}),
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
      cards: {
        where: { isActive: true, itemType: "CARD" },
        take: 1,
        orderBy: [{ cardNumber: "asc" }, { name: "asc" }],
        select: {
          imageThumbUrl: true,
          imageLargeUrl: true,
          imageBaseUrl: true,
        },
      },
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
    ...(resolvedGame !== "ALL" ? { game: resolvedGame } : {}),
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
        cards: {
          where: { isActive: true, itemType: "CARD" },
          take: 1,
          orderBy: [{ cardNumber: "asc" }, { name: "asc" }],
          select: {
            imageThumbUrl: true,
            imageLargeUrl: true,
            imageBaseUrl: true,
          },
        },
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
      ...(function () {
        const firstCard = set.cards[0];
        const fallbackImage = firstCard?.imageLargeUrl ?? firstCard?.imageThumbUrl ?? firstCard?.imageBaseUrl ?? null;
        return {
          resolvedLogoImageUrl: set.logoImageUrl ?? fallbackImage,
          resolvedSymbolImageUrl: set.symbolImageUrl ?? fallbackImage,
        };
      })(),
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
      symbolImageUrl: set.symbolImageUrl ?? set.cards[0]?.imageThumbUrl ?? set.cards[0]?.imageBaseUrl ?? null,
      logoImageUrl: set.logoImageUrl ?? set.cards[0]?.imageLargeUrl ?? set.cards[0]?.imageThumbUrl ?? set.cards[0]?.imageBaseUrl ?? null,
      bannerImageUrl: set.bannerImageUrl,
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
      logoImageUrl:
        catalogSet.logoImageUrl ??
        catalogSet.cards[0]?.imageLargeUrl ??
        catalogSet.cards[0]?.imageThumbUrl ??
        catalogSet.cards[0]?.imageBaseUrl ??
        null,
      symbolImageUrl:
        catalogSet.symbolImageUrl ??
        catalogSet.cards[0]?.imageThumbUrl ??
        catalogSet.cards[0]?.imageBaseUrl ??
        null,
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

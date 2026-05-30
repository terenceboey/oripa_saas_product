import { prisma } from "../src/lib/prisma";
import { CatalogItemType } from "@prisma/client";

function asText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeTokens(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).toLowerCase().trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureGame(code: string) {
  return prisma.canonicalCatalogGame.upsert({
    where: { code },
    update: { name: code.replace(/_/g, " "), isActive: true },
    create: { code, name: code.replace(/_/g, " "), isActive: true },
    select: { id: true, code: true },
  });
}

async function main() {
  const games = await prisma.catalogItem.findMany({
    distinct: ["game"],
    select: { game: true },
  });

  const gameMap = new Map<string, { id: string; code: string }>();
  for (const g of games) {
    const canonicalGame = await ensureGame(g.game);
    gameMap.set(g.game, canonicalGame);
  }

  const sets = await prisma.catalogSet.findMany({
    where: { isActive: true },
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
      isActive: true,
    },
  });

  const setMap = new Map<string, string>();
  for (const set of sets) {
    const game = gameMap.get(set.game);
    if (!game) continue;
    const row = await prisma.canonicalCatalogSet.upsert({
      where: {
        gameId_source_sourceSetId: {
          gameId: game.id,
          source: set.source,
          sourceSetId: set.sourceSetId,
        },
      },
      update: {
        setCode: set.setCode,
        name: set.name,
        slug: slugify(`${set.game}-${set.sourceSetId}-${set.name}`),
        releaseDate: set.releaseDate,
        totalCards: set.productCount ?? undefined,
        printedTotal: set.productCount ?? undefined,
        symbolImageUrl: set.symbolImageUrl,
        logoImageUrl: set.logoImageUrl,
        bannerImageUrl: set.bannerImageUrl,
        isActive: set.isActive,
      },
      create: {
        gameId: game.id,
        source: set.source,
        sourceSetId: set.sourceSetId,
        setCode: set.setCode,
        name: set.name,
        slug: slugify(`${set.game}-${set.sourceSetId}-${set.name}`),
        releaseDate: set.releaseDate,
        totalCards: set.productCount ?? undefined,
        printedTotal: set.productCount ?? undefined,
        symbolImageUrl: set.symbolImageUrl,
        logoImageUrl: set.logoImageUrl,
        bannerImageUrl: set.bannerImageUrl,
        series: null,
        isActive: set.isActive,
      },
      select: { id: true },
    });
    setMap.set(set.id, row.id);
  }

  const cards = await prisma.catalogItem.findMany({
    where: { itemType: CatalogItemType.CARD, isActive: true },
    select: {
      id: true,
      game: true,
      source: true,
      sourceItemId: true,
      language: true,
      name: true,
      setName: true,
      cardNumber: true,
      rarity: true,
      imageThumbUrl: true,
      imageLargeUrl: true,
      imageBaseUrl: true,
      searchText: true,
      catalogSetId: true,
      isActive: true,
    },
  });

  for (const card of cards) {
    const game = gameMap.get(card.game);
    if (!game) continue;
    const canonicalSetId = card.catalogSetId ? setMap.get(card.catalogSetId) ?? null : null;
    const canonicalCard = await prisma.canonicalCatalogCard.upsert({
      where: {
        source_sourceCardId_language_gameId: {
          source: card.source,
          sourceCardId: card.sourceItemId,
          language: card.language,
          gameId: game.id,
        },
      },
      update: {
        setId: canonicalSetId,
        name: card.name,
        displayName: card.name,
        cardNumber: card.cardNumber,
        rarity: card.rarity,
        imageThumbUrl: card.imageThumbUrl,
        imageLargeUrl: card.imageLargeUrl,
        imageBaseUrl: card.imageBaseUrl,
        searchText: card.searchText,
        isActive: card.isActive,
      },
      create: {
        gameId: game.id,
        setId: canonicalSetId,
        source: card.source,
        sourceCardId: card.sourceItemId,
        name: card.name,
        displayName: card.name,
        cardNumber: card.cardNumber,
        rarity: card.rarity,
        language: card.language,
        imageThumbUrl: card.imageThumbUrl,
        imageLargeUrl: card.imageLargeUrl,
        imageBaseUrl: card.imageBaseUrl,
        searchText: card.searchText,
        isActive: card.isActive,
      },
      select: { id: true },
    });

    await prisma.canonicalSearchDoc.upsert({
      where: {
        entityType_entityId_gameId: {
          entityType: "CARD",
          entityId: canonicalCard.id,
          gameId: game.id,
        },
      },
      update: {
        setId: canonicalSetId,
        displayName: card.name,
        tokens: normalizeTokens([card.name, card.cardNumber, card.rarity, card.setName, card.game]),
        imageThumbUrl: card.imageThumbUrl ?? card.imageLargeUrl ?? card.imageBaseUrl,
        isActive: card.isActive,
      },
      create: {
        entityType: "CARD",
        entityId: canonicalCard.id,
        gameId: game.id,
        setId: canonicalSetId,
        displayName: card.name,
        tokens: normalizeTokens([card.name, card.cardNumber, card.rarity, card.setName, card.game]),
        imageThumbUrl: card.imageThumbUrl ?? card.imageLargeUrl ?? card.imageBaseUrl,
        isActive: card.isActive,
      },
    });
  }

  const sealed = await prisma.catalogSealedProduct.findMany({
    where: { isActive: true },
    select: {
      game: true,
      source: true,
      sourceProductId: true,
      language: true,
      catalogSetId: true,
      name: true,
      cleanName: true,
      imageUrl: true,
      searchText: true,
      isActive: true,
    },
  });

  for (const item of sealed) {
    const game = gameMap.get(item.game);
    if (!game) continue;
    const canonicalSetId = item.catalogSetId ? setMap.get(item.catalogSetId) ?? null : null;
    const canonicalSealed = await prisma.canonicalSealedProduct.upsert({
      where: {
        source_sourceProductId_language_gameId: {
          source: item.source,
          sourceProductId: item.sourceProductId,
          language: item.language,
          gameId: game.id,
        },
      },
      update: {
        setId: canonicalSetId,
        name: item.name,
        displayName: item.cleanName ?? item.name,
        imageUrl: item.imageUrl,
        imageThumbUrl: item.imageUrl,
        searchText: item.searchText,
        isActive: item.isActive,
      },
      create: {
        gameId: game.id,
        setId: canonicalSetId,
        source: item.source,
        sourceProductId: item.sourceProductId,
        language: item.language,
        name: item.name,
        displayName: item.cleanName ?? item.name,
        imageUrl: item.imageUrl,
        imageThumbUrl: item.imageUrl,
        searchText: item.searchText,
        isActive: item.isActive,
      },
      select: { id: true },
    });

    await prisma.canonicalSearchDoc.upsert({
      where: {
        entityType_entityId_gameId: {
          entityType: "SEALED_PRODUCT",
          entityId: canonicalSealed.id,
          gameId: game.id,
        },
      },
      update: {
        setId: canonicalSetId,
        displayName: item.cleanName ?? item.name,
        tokens: normalizeTokens([item.name, item.cleanName, item.game]),
        imageThumbUrl: item.imageUrl,
        isActive: item.isActive,
      },
      create: {
        entityType: "SEALED_PRODUCT",
        entityId: canonicalSealed.id,
        gameId: game.id,
        setId: canonicalSetId,
        displayName: item.cleanName ?? item.name,
        tokens: normalizeTokens([item.name, item.cleanName, item.game]),
        imageThumbUrl: item.imageUrl,
        isActive: item.isActive,
      },
    });
  }

  const canonicalSets = await prisma.canonicalCatalogSet.findMany({
    where: { isActive: true },
    select: { id: true, gameId: true, name: true, setCode: true, sourceSetId: true },
  });
  for (const set of canonicalSets) {
    await prisma.canonicalSearchDoc.upsert({
      where: {
        entityType_entityId_gameId: {
          entityType: "SET",
          entityId: set.id,
          gameId: set.gameId,
        },
      },
      update: {
        setId: set.id,
        displayName: set.name,
        tokens: normalizeTokens([set.name, set.setCode, set.sourceSetId]),
        isActive: true,
      },
      create: {
        entityType: "SET",
        entityId: set.id,
        gameId: set.gameId,
        setId: set.id,
        displayName: set.name,
        tokens: normalizeTokens([set.name, set.setCode, set.sourceSetId]),
        isActive: true,
      },
    });
  }

  const summary = {
    games: await prisma.canonicalCatalogGame.count(),
    sets: await prisma.canonicalCatalogSet.count(),
    cards: await prisma.canonicalCatalogCard.count(),
    sealed: await prisma.canonicalSealedProduct.count(),
    docs: await prisma.canonicalSearchDoc.count(),
  };
  console.log("[canonical-backfill] completed", summary);
}

main()
  .catch((error) => {
    console.error("[canonical-backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


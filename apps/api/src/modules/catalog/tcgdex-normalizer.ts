import { CatalogItemType, Prisma } from "@prisma/client";

export const TCGDEX_SOURCE = "tcgdex";
export const POKEMON_GAME = "POKEMON";

export type TcgdexSetBrief = {
  id?: unknown;
  name?: unknown;
};

export type TcgdexCard = {
  id?: unknown;
  localId?: unknown;
  name?: unknown;
  image?: unknown;
  category?: unknown;
  illustrator?: unknown;
  rarity?: unknown;
  set?: TcgdexSetBrief | null;
  [key: string]: unknown;
};

export type CatalogItemProjection = {
  source: string;
  sourceItemId: string;
  localId: string | null;
  itemType: CatalogItemType;
  game: string;
  language: string;
  name: string;
  setId: string | null;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageBaseUrl: string | null;
  imageThumbUrl: string | null;
  imageLargeUrl: string | null;
  searchText: string;
  isActive: true;
  sourcePayload: Prisma.InputJsonValue;
};

export function asNonEmptyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export function normalizeTcgdexImageUrl(image: string | null, variant: "low" | "high"): string | null {
  if (!image) return null;
  if (/\.(png|jpe?g|webp)$/i.test(image)) return image;
  return `${image}/${variant}.webp`;
}

export function buildTcgdexSearchText(input: {
  name: string;
  setName?: string | null;
  setId?: string | null;
  localId?: string | null;
  rarity?: string | null;
  category?: string | null;
  illustrator?: string | null;
}): string {
  return [
    input.name,
    input.setName,
    input.setId,
    input.localId,
    input.rarity,
    input.category,
    input.illustrator,
    "pokemon",
    "card",
    TCGDEX_SOURCE,
  ]
    .map((part) => asNonEmptyString(part))
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function normalizeTcgdexCardForCatalog(
  card: TcgdexCard,
  options: { language: string; game?: string } = { language: "en" },
): CatalogItemProjection | null {
  const sourceItemId = asNonEmptyString(card.id);
  const name = asNonEmptyString(card.name);
  const localId = asNonEmptyString(card.localId);

  if (!sourceItemId || !name || !localId) return null;

  const setId = asNonEmptyString(card.set?.id);
  const setName = asNonEmptyString(card.set?.name);
  const rarity = asNonEmptyString(card.rarity);
  const category = asNonEmptyString(card.category);
  const illustrator = asNonEmptyString(card.illustrator);
  const imageBaseUrl = asNonEmptyString(card.image);

  return {
    source: TCGDEX_SOURCE,
    sourceItemId,
    localId,
    itemType: CatalogItemType.CARD,
    game: options.game ?? POKEMON_GAME,
    language: options.language,
    name,
    setId,
    setName,
    cardNumber: localId,
    rarity,
    imageBaseUrl,
    imageThumbUrl: normalizeTcgdexImageUrl(imageBaseUrl, "low"),
    imageLargeUrl: normalizeTcgdexImageUrl(imageBaseUrl, "high"),
    searchText: buildTcgdexSearchText({ name, setName, setId, localId, rarity, category, illustrator }),
    isActive: true,
    sourcePayload: card as Prisma.InputJsonValue,
  };
}

import { CatalogItemType, Prisma } from "@prisma/client";

export const POKEMONCARD_IO_SOURCE = "pokemoncard.io";
export const ONEPIECEDB_IO_SOURCE = "onepiecedb.io";
export const BULBAPEDIA_SOURCE = "bulbapedia";

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

export type CatalogSetProjection = {
  source: string;
  sourceSetId: string;
  game: string;
  setCode: string | null;
  name: string;
  releaseDate: Date | null;
  productCount: number | null;
  symbolImageUrl: string | null;
  logoImageUrl: string | null;
  bannerImageUrl: string | null;
  isSupplemental: boolean;
  searchText: string;
  isActive: true;
};

export type PokemonCardIoCard = Record<string, unknown>;
export type OnePieceDbCard = Record<string, unknown>;

export function asNonEmptyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseDate(value: unknown): Date | null {
  const text = asNonEmptyString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLanguage(value: unknown, fallback: string): string {
  const text = asNonEmptyString(value)?.toLowerCase();
  if (!text) return fallback;
  if (["eng", "english", "en"].includes(text)) return "en";
  return text.slice(0, 8);
}

function compactSearchText(parts: Array<unknown>): string {
  return parts
    .map((part) => asNonEmptyString(part))
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function buildExternalCardSearchText(input: {
  name: string;
  setName?: string | null;
  setCode?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  game: string;
  source: string;
  extra?: Array<unknown>;
}): string {
  return compactSearchText([
    input.name,
    input.setName,
    input.setCode,
    input.cardNumber,
    input.rarity,
    input.game,
    "card",
    input.source,
    ...(input.extra ?? []),
  ]);
}

export function buildExternalSetSearchText(input: {
  name: string;
  setCode?: string | null;
  game: string;
  source: string;
}): string {
  return compactSearchText([input.name, input.setCode, input.game, "set", input.source]);
}

export function normalizePokemonCardIoCardForCatalog(card: PokemonCardIoCard): CatalogItemProjection | null {
  const sourceItemId = asNonEmptyString(card.id);
  const name = asNonEmptyString(card.name);
  if (!sourceItemId || !name) return null;

  const setCode = asNonEmptyString(card.setCode);
  const setName = asNonEmptyString(card.setName);
  const cardNumber = asNonEmptyString(card.cardnumber) ?? asNonEmptyString(card.number) ?? asNonEmptyString(card.card_number);
  const rarity = asNonEmptyString(card.rarity);
  const language = normalizeLanguage(card.locale, "en");
  const image = asNonEmptyString(card.image_url);
  const highResImage = asNonEmptyString(card.high_res_image_url) ?? image;

  return {
    source: POKEMONCARD_IO_SOURCE,
    sourceItemId,
    localId: cardNumber,
    itemType: CatalogItemType.CARD,
    game: "POKEMON",
    language,
    name,
    setId: setCode,
    setName,
    cardNumber,
    rarity,
    imageBaseUrl: image,
    imageThumbUrl: image,
    imageLargeUrl: highResImage,
    searchText: buildExternalCardSearchText({
      name,
      setName,
      setCode,
      cardNumber,
      rarity,
      game: "POKEMON",
      source: POKEMONCARD_IO_SOURCE,
      extra: [card.supertype, card.subtype, card.types, card.artist],
    }),
    isActive: true,
    sourcePayload: { source: POKEMONCARD_IO_SOURCE, raw: card } as Prisma.InputJsonValue,
  };
}

export function normalizePokemonCardIoSetFromCard(card: PokemonCardIoCard): CatalogSetProjection | null {
  const setCode = asNonEmptyString(card.setCode);
  const setName = asNonEmptyString(card.setName);
  if (!setCode || !setName) return null;
  return {
    source: POKEMONCARD_IO_SOURCE,
    sourceSetId: setCode,
    game: "POKEMON",
    setCode,
    name: setName,
    releaseDate: parseDate(card.releaseDate),
    productCount: null,
    symbolImageUrl: null,
    logoImageUrl: null,
    bannerImageUrl: null,
    isSupplemental: false,
    searchText: buildExternalSetSearchText({ name: setName, setCode, game: "POKEMON", source: POKEMONCARD_IO_SOURCE }),
    isActive: true,
  };
}

export function normalizeOnePieceDbCardForCatalog(card: OnePieceDbCard): CatalogItemProjection | null {
  const sourceItemId = asNonEmptyString(card.id) ?? asNonEmptyString(card.printed_number) ?? asNonEmptyString(card.card_number);
  const name = asNonEmptyString(card.name);
  if (!sourceItemId || !name) return null;

  const setCode = asNonEmptyString(card.setCode);
  const setName = asNonEmptyString(card.setName);
  const cardNumber = asNonEmptyString(card.card_number) ?? asNonEmptyString(card.printed_number) ?? asNonEmptyString(card.number);
  const rarity = asNonEmptyString(card.rarity) ?? asNonEmptyString(card.rarity_code);
  const language = normalizeLanguage(card.language_code ?? card.language, "en");
  const image = asNonEmptyString(card.image_url);
  const highResImage = asNonEmptyString(card.high_res_image_url) ?? image;

  return {
    source: ONEPIECEDB_IO_SOURCE,
    sourceItemId,
    localId: cardNumber,
    itemType: CatalogItemType.CARD,
    game: "ONE_PIECE",
    language,
    name,
    setId: setCode,
    setName,
    cardNumber,
    rarity,
    imageBaseUrl: image,
    imageThumbUrl: image,
    imageLargeUrl: highResImage,
    searchText: buildExternalCardSearchText({
      name,
      setName,
      setCode,
      cardNumber,
      rarity,
      game: "ONE_PIECE",
      source: ONEPIECEDB_IO_SOURCE,
      extra: [card.type, card.color1, card.color2, card.attribute, card.subtype1, card.subtype2, card.subtype3, card.rules],
    }),
    isActive: true,
    sourcePayload: { source: ONEPIECEDB_IO_SOURCE, raw: card } as Prisma.InputJsonValue,
  };
}

export function normalizeOnePieceDbSetFromCard(card: OnePieceDbCard): CatalogSetProjection | null {
  const setCode = asNonEmptyString(card.setCode);
  const setName = asNonEmptyString(card.setName);
  if (!setCode || !setName) return null;
  return {
    source: ONEPIECEDB_IO_SOURCE,
    sourceSetId: setCode,
    game: "ONE_PIECE",
    setCode,
    name: setName,
    releaseDate: parseDate(card.releaseDate),
    productCount: null,
    symbolImageUrl: null,
    logoImageUrl: null,
    bannerImageUrl: null,
    isSupplemental: false,
    searchText: buildExternalSetSearchText({ name: setName, setCode, game: "ONE_PIECE", source: ONEPIECEDB_IO_SOURCE }),
    isActive: true,
  };
}

export function slugifySourceSetId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function normalizeBulbapediaExpansionSet(input: { name: string; releaseDate?: Date | null; productCount?: number | null }): CatalogSetProjection | null {
  const name = asNonEmptyString(input.name);
  if (!name) return null;
  const sourceSetId = slugifySourceSetId(name);
  if (!sourceSetId) return null;
  return {
    source: BULBAPEDIA_SOURCE,
    sourceSetId,
    game: "POKEMON",
    setCode: null,
    name,
    releaseDate: input.releaseDate ?? null,
    productCount: input.productCount ?? null,
    symbolImageUrl: null,
    logoImageUrl: null,
    bannerImageUrl: null,
    isSupplemental: true,
    searchText: buildExternalSetSearchText({ name, game: "POKEMON", source: BULBAPEDIA_SOURCE }),
    isActive: true,
  };
}

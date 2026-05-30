export type CatalogItemClass =
  | "CARD"
  | "SEALED_PRODUCT"
  | "SET"
  | "SLAB"
  | "CUSTOM_ITEM"
  | "ACCESSORY"
  | "BONUS";

export type SourceRankUseCase = "SEARCH_DISPLAY" | "SET_IMAGERY" | "CARD_DETAILS" | "MERGE_CANONICAL";

export type SourceRankPolicy = {
  displayRank: number;
  collapseEligible: boolean;
};

export type SourceRankInput = {
  game?: string | null;
  itemClass: CatalogItemClass;
  source?: string | null;
  useCase: SourceRankUseCase;
};

const DEFAULT_POLICY: SourceRankPolicy = {
  displayRank: 1_000,
  collapseEligible: false,
};

function sourceKey(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function gameKey(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

export function getSourceRank(input: SourceRankInput): SourceRankPolicy {
  const source = sourceKey(input.source);
  const game = gameKey(input.game);

  if (input.itemClass === "SET" && (input.useCase === "SET_IMAGERY" || input.useCase === "SEARCH_DISPLAY")) {
    if (source === "tcgtracking") return { displayRank: 0, collapseEligible: true };
    if (source === "bulbapedia") return { displayRank: 20, collapseEligible: false };
    return DEFAULT_POLICY;
  }

  if (input.itemClass === "CARD" && (input.useCase === "SEARCH_DISPLAY" || input.useCase === "CARD_DETAILS")) {
    if (game === "POKEMON" && source === "pokemoncard.io") return { displayRank: 0, collapseEligible: true };
    if (game === "ONE_PIECE" && source === "onepiecedb.io") return { displayRank: 0, collapseEligible: true };
    if (source === "tcgtracking") return { displayRank: 10, collapseEligible: true };
    return { displayRank: 50, collapseEligible: false };
  }

  if (input.itemClass === "SEALED_PRODUCT" && input.useCase === "SEARCH_DISPLAY") {
    if (source === "tcgtracking") return { displayRank: 0, collapseEligible: true };
    return DEFAULT_POLICY;
  }

  return DEFAULT_POLICY;
}

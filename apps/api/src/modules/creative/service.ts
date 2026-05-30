import crypto from "crypto";

export const CREATIVE_PUBLISH_BLOCKERS = [
  "legal_approval_for_card_image_promotional_use_required",
  "immutable_public_storage_not_configured",
  "publish_time_pack_revalidation_not_enabled",
] as const;

const STYLE_PROMPTS: Record<string, string> = {
  premium_foil: "abstract premium foil gradient, luminous metallic waves, soft studio glow, empty center stage, no text",
  neon_arcade: "abstract neon arcade energy, electric gradients, geometric light trails, empty center stage, no text",
  dark_luxury: "abstract dark luxury backdrop, subtle gold particles, velvet shadows, empty center stage, no text",
  clean_showcase: "abstract clean showcase background, soft radial lighting, polished glass floor, empty center stage, no text",
};

export type CreativePrizeInput = {
  id: string;
  label: string;
  imageUrl?: string | null;
  imageLargeUrl?: string | null;
  setId?: string | null;
  setName?: string | null;
  localId?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  estimatedValue: number;
  weight: number;
  stock: number;
  remainingStock: number;
  catalogItemId?: string | null;
  catalogSource?: string | null;
  catalogSourceItemId?: string | null;
  catalogSnapshot?: unknown;
};

export type CreativePackInput = {
  id: string;
  title: string;
  status: string;
  pricePoints: number;
  totalStock: number;
  remainingStock: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  prizes: CreativePrizeInput[];
};

export function buildSafeCreativePrompt(stylePreset: string) {
  return STYLE_PROMPTS[stylePreset] ?? STYLE_PROMPTS.premium_foil;
}

export function buildForbiddenTerms(pack: CreativePackInput) {
  const terms = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = String(value ?? "").trim();
    if (trimmed.length >= 2) terms.add(trimmed);
  };

  add(pack.title);
  for (const prize of pack.prizes) {
    add(prize.label);
    add(prize.setName);
    add(prize.setId);
    add(prize.localId);
    add(prize.cardNumber);
    add(prize.rarity);
  }

  // Static protected identity guardrails for this vertical. These are not sent to the provider.
  for (const term of ["Pokemon", "Pokémon", "Pikachu", "Charizard", "Nintendo", "Game Freak", "Creatures", "logo"]) {
    terms.add(term);
  }
  return [...terms];
}

export function assertPromptSafe(prompt: string, forbiddenTerms: string[]) {
  const lowerPrompt = prompt.toLowerCase();
  const leaked = forbiddenTerms.filter((term) => {
    const normalized = term.trim().toLowerCase();
    return normalized.length >= 3 && lowerPrompt.includes(normalized);
  });
  if (leaked.length > 0) {
    throw new Error(`Creative prompt leaked protected terms: ${leaked.join(", ")}`);
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function topPrizes(pack: CreativePackInput) {
  return [...pack.prizes]
    .sort((a, b) => b.estimatedValue - a.estimatedValue || b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, 3);
}

export function snapshotPackForCreative(pack: CreativePackInput) {
  return {
    id: pack.id,
    title: pack.title,
    status: pack.status,
    pricePoints: pack.pricePoints,
    totalStock: pack.totalStock,
    remainingStock: pack.remainingStock,
    startsAt: pack.startsAt ? new Date(pack.startsAt).toISOString() : null,
    endsAt: pack.endsAt ? new Date(pack.endsAt).toISOString() : null,
  };
}

export function snapshotPrizesForCreative(pack: CreativePackInput) {
  return topPrizes(pack).map((prize) => ({
    id: prize.id,
    label: prize.label,
    imageUrl: prize.imageLargeUrl ?? prize.imageUrl ?? null,
    estimatedValue: prize.estimatedValue,
    weight: prize.weight,
    stock: prize.stock,
    remainingStock: prize.remainingStock,
    catalogItemId: prize.catalogItemId ?? null,
    catalogSource: prize.catalogSource ?? null,
    catalogSourceItemId: prize.catalogSourceItemId ?? null,
    setId: prize.setId ?? null,
    setName: prize.setName ?? null,
    localId: prize.localId ?? null,
    cardNumber: prize.cardNumber ?? null,
    rarity: prize.rarity ?? null,
    catalogSnapshot: prize.catalogSnapshot ?? null,
  }));
}

export function renderPrivateDraftSvg(pack: CreativePackInput, stylePreset: string) {
  const prizes = topPrizes(pack);
  const prompt = buildSafeCreativePrompt(stylePreset);
  const accent = stylePreset === "neon_arcade" ? "#45f3ff" : stylePreset === "dark_luxury" ? "#d8ad54" : stylePreset === "clean_showcase" ? "#8ab4ff" : "#f7d774";
  const cards = prizes.map((prize, index) => {
    const x = 465 + index * 235;
    const y = index === 1 ? 172 : 210;
    const rotate = index === 0 ? -8 : index === 2 ? 8 : 0;
    const image = escapeXml(prize.imageLargeUrl ?? prize.imageUrl ?? "");
    const title = escapeXml(prize.label.slice(0, 42));
    const imageNode = image
      ? `<image href="${image}" x="${x}" y="${y}" width="190" height="265" preserveAspectRatio="xMidYMid meet"/>`
      : `<rect x="${x}" y="${y}" width="190" height="265" rx="18" fill="#1f2937" stroke="${accent}" stroke-width="3"/>`;
    return `<g transform="rotate(${rotate} ${x + 95} ${y + 132})"><rect x="${x - 10}" y="${y - 10}" width="210" height="330" rx="24" fill="rgba(0,0,0,0.42)" stroke="${accent}" stroke-width="2"/>${imageNode}<text x="${x + 95}" y="${y + 304}" text-anchor="middle" fill="#ffffff" font-size="18" font-family="Arial, sans-serif">${title}</text></g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/><stop offset="45%" stop-color="#1f1147"/><stop offset="100%" stop-color="#080813"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="12" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="1600" height="900" fill="url(#bg)"/><circle cx="800" cy="440" r="330" fill="none" stroke="${accent}" stroke-opacity="0.36" stroke-width="8" filter="url(#glow)"/><text x="120" y="155" fill="#ffffff" font-size="74" font-weight="800" font-family="Arial, sans-serif">${escapeXml(pack.title.slice(0, 48))}</text><text x="124" y="218" fill="${accent}" font-size="34" font-weight="700" font-family="Arial, sans-serif">PRIVATE DRAFT · pack-anchored creative</text>${cards}<rect x="1130" y="690" width="340" height="86" rx="43" fill="${accent}"/><text x="1300" y="745" fill="#101014" font-size="36" font-weight="800" text-anchor="middle" font-family="Arial, sans-serif">Review draft</text><text x="120" y="815" fill="#d1d5db" font-size="24" font-family="Arial, sans-serif">Background prompt: ${escapeXml(prompt)}</text></svg>`;
}

export function buildPrivateDraftAsset(pack: CreativePackInput, stylePreset: string) {
  const svg = renderPrivateDraftSvg(pack, stylePreset);
  const contentHash = crypto.createHash("sha256").update(svg).digest("hex");
  return {
    title: `${pack.title} creative draft`,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    targetUrl: `/packs/${pack.id}`,
    contentHash,
    width: 1600,
    height: 900,
    metadata: {
      renderer: "oripa-mvp-svg-compositor",
      aiProvider: "none_mock_background_only",
      stylePreset,
    },
  };
}

import crypto from "crypto";
import { PROMPT_PACK_TEMPLATES } from "@oripa/shared";

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
  importantNotes?: string | null;
  drawLimitMode?: "NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET" | string | null;
  drawLimitValue?: number | null;
  drawLimitResetTimezone?: string | null;
  poolSnapshotHash?: string | null;
  tierSnapshotJson?: unknown;
  prizes: CreativePrizeInput[];
};


export type BannerCardAsset = {
  id: string;
  source: "pack_prize";
  packId: string;
  packPrizeId: string;
  catalogItemId: string | null;
  catalogSource: string | null;
  catalogSourceItemId: string | null;
  label: string;
  imageUrl: string | null;
  estimatedValue: number;
  remainingStock: number;
  eligibleForPublish: boolean;
  snapshotHash: string;
  searchText: string;
};

export function buildBannerCardAssetsFromPack(pack: CreativePackInput): BannerCardAsset[] {
  return [...pack.prizes]
    .sort((a, b) => b.estimatedValue - a.estimatedValue || a.label.localeCompare(b.label))
    .map((prize) => {
      const imageUrl = prize.imageLargeUrl ?? prize.imageUrl ?? null;
      const snapshot = {
        source: "pack_prize",
        packId: pack.id,
        packPrizeId: prize.id,
        catalogItemId: prize.catalogItemId ?? null,
        catalogSource: prize.catalogSource ?? null,
        catalogSourceItemId: prize.catalogSourceItemId ?? null,
        label: prize.label,
        imageUrl,
        estimatedValue: prize.estimatedValue,
        remainingStock: prize.remainingStock,
        setId: prize.setId ?? null,
        setName: prize.setName ?? null,
        localId: prize.localId ?? null,
        cardNumber: prize.cardNumber ?? null,
        rarity: prize.rarity ?? null,
      };
      return {
        id: `pack_prize:${prize.id}`,
        source: "pack_prize" as const,
        packId: pack.id,
        packPrizeId: prize.id,
        catalogItemId: prize.catalogItemId ?? null,
        catalogSource: prize.catalogSource ?? null,
        catalogSourceItemId: prize.catalogSourceItemId ?? null,
        label: prize.label,
        imageUrl,
        estimatedValue: prize.estimatedValue,
        remainingStock: prize.remainingStock,
        eligibleForPublish: true,
        snapshotHash: crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
        searchText: [prize.label, prize.setName, prize.setId, prize.localId, prize.cardNumber, prize.rarity, prize.catalogSource]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });
}

export type BannerTemplateField = {
  key: string;
  label: string;
  type: "text" | "select" | "asset_picker" | "select_from_hero_cards";
  required: boolean;
  maxChars?: number;
  example?: string;
  claimSensitive?: boolean;
  options?: string[];
};

export type BannerTemplate = {
  id: string;
  promptPackIndex?: number;
  name: string;
  description: string;
  modelTarget: "gpt-image-2";
  promptSeed?: string;
  negativePrompt?: string;
  defaults: {
    bannerRatio: "3:2" | "16:9";
    styleIntensity: "flashy" | "ultra_flashy" | "insane_arcade";
    mascotMode: "primary_card_inspired" | "lucky_arcade_host" | "no_mascot";
    cardDisplayStyle: "auto" | "raw_cards" | "glossy_card_frames" | "generic_graded_slabs" | "real_slab_only";
    fields: {
      headline: string;
      topLeftBadge: string;
      topCenterBadge: string;
      topRightBadge: string;
      roundSticker: string;
    };
  };
  fields: BannerTemplateField[];
};

export type CreativeHeroAssetInput = {
  assetId: string;
  source: "upload" | "pack_prize";
  imageUrl: string;
  displayName: string;
  snapshotHash: string;
  contentHash?: string;
};

export type BannerTemplatePayload = {
  templateId?: string;
  stylePreset?: string;
  aspectRatio?: string;
  bannerRatio?: "3:2" | "16:9";
  styleIntensity?: "flashy" | "ultra_flashy" | "insane_arcade";
  mascotMode?: "primary_card_inspired" | "lucky_arcade_host" | "no_mascot";
  cardDisplayStyle?: "auto" | "raw_cards" | "glossy_card_frames" | "generic_graded_slabs" | "real_slab_only";
  heroCardIds?: string[];
  primaryCardId?: string;
  heroAssets?: CreativeHeroAssetInput[];
  primaryHeroAssetId?: string;
  fields?: {
    headline: string;
    topLeftBadge: string;
    topCenterBadge: string;
    topRightBadge: string;
    roundSticker?: string;
  };
};

export const BANNER_TEMPLATE_REGISTRY: BannerTemplate[] = [...PROMPT_PACK_TEMPLATES];

export function getBannerTemplate(templateId = "jp_arcade_guaranteed_hit_v1") {
  const template = BANNER_TEMPLATE_REGISTRY.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Unknown banner template: ${templateId}`);
  return template;
}

function normalizeTemplatePayload(payload: BannerTemplatePayload) {
  const template = getBannerTemplate(payload.templateId);
  return {
    template,
    bannerRatio: payload.bannerRatio ?? template.defaults.bannerRatio,
    styleIntensity: payload.styleIntensity ?? template.defaults.styleIntensity,
    mascotMode: payload.mascotMode ?? template.defaults.mascotMode,
    cardDisplayStyle: payload.cardDisplayStyle ?? template.defaults.cardDisplayStyle,
    heroCardIds: payload.heroCardIds ?? [],
    primaryCardId: payload.primaryCardId ?? payload.heroCardIds?.[0],
    heroAssets: payload.heroAssets ?? [],
    primaryHeroAssetId: payload.primaryHeroAssetId ?? payload.heroAssets?.[0]?.assetId,
    fields: {
      ...template.defaults.fields,
      ...(payload.fields ?? {}),
    },
  };
}

const STYLE_INTENSITY_PROMPTS: Record<string, string> = {
  flashy: "Style intensity: flashy but readable. Energetic Japanese arcade gacha ad with saturated colors, foil shine, and premium collectible card promo feel.",
  ultra_flashy: "Style intensity: ultra flashy. Bright saturated colors, explosive background, rainbow foil effects, sparkles, lightning, fire glow, coins, glossy casino-style energy, premium but chaotic.",
  insane_arcade: "Style intensity: maximum arcade chaos while keeping mobile readability. Huge glowing typography, fireworks, lightning, coins, confetti, rainbow foil, dense Japanese mobile gacha promo energy.",
};

const MASCOT_PROMPTS: Record<string, string> = {
  primary_card_inspired: "Add a cute energetic original mascot on the left side pointing toward the cards. The mascot should be inspired by the selected primary card's color palette, energy, and mood, but must not copy the card character, official mascot, or copyrighted creature design.",
  lucky_arcade_host: "Add a cute energetic original arcade host mascot on the left side pointing toward the cards, with lucky charm and card shop promoter energy.",
  no_mascot: "Do not include a mascot. Use coins, flares, and graphic effects on the left side instead.",
};

const CARD_DISPLAY_PROMPTS: Record<string, string> = {
  auto: "Use a premium display style appropriate to the uploaded card images. If the source image is already slabbed, preserve that slab. If not, use glossy card frames rather than fake grading labels.",
  raw_cards: "Show the uploaded cards as raw cards with glow and foil effects. Do not put them in slabs or grading cases.",
  glossy_card_frames: "Add glossy premium display frames and shine around the cards, but do not add grading labels, PSA logos, or certification numbers.",
  generic_graded_slabs: "Place the cards in generic graded-card style slabs with shine and premium casing. Do not use PSA logos, real grading company branding, cert numbers, or specific grade labels unless visible in the uploaded image.",
  real_slab_only: "Only show slab or graded casing if the uploaded source image already shows a slab. Otherwise preserve the raw card image.",
};

type CreativePackEconomics = ReturnType<typeof summarizePackEconomicsForCreative>;

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatPercent(value: number | null) {
  if (value === null) return "unconfigured";
  return Number.isInteger(value) ? `${value}%` : `${Number(value.toFixed(4))}%`;
}

function resolveTierSnapshotTiers(snapshot: unknown) {
  const tiers = typeof snapshot === "object" && snapshot !== null && Array.isArray((snapshot as { tiers?: unknown }).tiers)
    ? (snapshot as { tiers: unknown[] }).tiers
    : [];
  const normalized = tiers
    .map((tier, index) => {
      if (typeof tier !== "object" || tier === null) return null;
      const record = tier as Record<string, unknown>;
      const items = Array.isArray(record.items) ? record.items : [];
      const stock = items.reduce((sum, item) => {
        if (typeof item !== "object" || item === null) return sum;
        return sum + Math.max(0, Math.trunc(asFiniteNumber((item as Record<string, unknown>).stock) ?? 0));
      }, 0);
      return {
        name: String(record.name ?? `Tier ${index + 1}`).trim() || `Tier ${index + 1}`,
        configuredPercentage: asFiniteNumber(record.percentage),
        itemCount: items.length,
        stock,
      };
    })
    .filter((tier): tier is { name: string; configuredPercentage: number | null; itemCount: number; stock: number } => Boolean(tier));

  const configuredTotal = normalized.reduce((sum, tier) => sum + (tier.configuredPercentage ?? 0), 0);
  const flexCount = normalized.filter((tier) => tier.configuredPercentage === null).length;
  const fallbackPercent = flexCount > 0 ? Math.max(0, 100 - configuredTotal) / flexCount : null;
  return normalized.map((tier) => ({
    name: tier.name,
    percentage: tier.configuredPercentage ?? fallbackPercent,
    itemCount: tier.itemCount,
    stock: tier.stock,
  }));
}

function buildPrizeOdds(prizes: CreativePrizeInput[]) {
  const totalWeight = prizes.reduce((sum, prize) => sum + Math.max(0, prize.weight), 0);
  return [...prizes]
    .sort((a, b) => b.estimatedValue - a.estimatedValue || b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, 10)
    .map((prize) => ({
      id: prize.id,
      label: prize.label,
      weight: prize.weight,
      chancePercent: totalWeight > 0 ? Number(((prize.weight / totalWeight) * 100).toFixed(4)) : 0,
      stock: prize.stock,
      remainingStock: prize.remainingStock,
      estimatedValue: prize.estimatedValue,
    }));
}

export function summarizePackEconomicsForCreative(pack: CreativePackInput) {
  const mode = String(pack.drawLimitMode ?? "NONE").trim() || "NONE";
  return {
    pricePoints: pack.pricePoints,
    totalStock: pack.totalStock,
    remainingStock: pack.remainingStock,
    startsAt: pack.startsAt ? new Date(pack.startsAt).toISOString() : null,
    endsAt: pack.endsAt ? new Date(pack.endsAt).toISOString() : null,
    notes: pack.importantNotes?.trim() || null,
    poolSnapshotHash: pack.poolSnapshotHash ?? null,
    drawRules: {
      mode,
      limitValue: pack.drawLimitValue ?? null,
      resetTimezone: pack.drawLimitResetTimezone ?? null,
    },
    tierOdds: resolveTierSnapshotTiers(pack.tierSnapshotJson),
    prizeOdds: buildPrizeOdds(pack.prizes),
  };
}

function formatDrawRules(economics: CreativePackEconomics) {
  const { mode, limitValue, resetTimezone } = economics.drawRules;
  if (mode === "NONE") return "NONE (no customer draw limit configured)";
  if (mode === "ONCE_PER_CUSTOMER") return `ONCE_PER_CUSTOMER (${limitValue ?? 1} per customer)`;
  if (mode === "DAILY_RESET") return `DAILY_RESET (${limitValue ?? 1} per reset${resetTimezone ? `, timezone ${resetTimezone}` : ""})`;
  return `${mode}${limitValue ? ` (${limitValue})` : ""}${resetTimezone ? `, timezone ${resetTimezone}` : ""}`;
}

function formatPackEconomicsForPrompt(economics: CreativePackEconomics) {
  const tierLines = economics.tierOdds.length > 0
    ? economics.tierOdds.map((tier) => `- ${tier.name}: ${formatPercent(tier.percentage)} chance, ${pluralize(tier.itemCount, "item")}, ${pluralize(tier.stock, "stock", "stock")}`).join("\n")
    : "- No tier snapshot configured; use weighted prize pool only.";
  const prizeLines = economics.prizeOdds.slice(0, 5)
    .map((prize) => `- ${prize.label}: ${formatPercent(prize.chancePercent)} weighted prize chance, ${prize.remainingStock}/${prize.stock} stock, ${prize.estimatedValue} pt estimated value`)
    .join("\n");
  return `Pack economics / draw rules:
- Price: ${economics.pricePoints} points per draw
- Stock: ${economics.remainingStock} remaining of ${economics.totalStock} total
- Draw limit: ${formatDrawRules(economics)}
${economics.startsAt ? `- Starts at: ${economics.startsAt}\n` : ""}${economics.endsAt ? `- Ends at: ${economics.endsAt}\n` : ""}${economics.poolSnapshotHash ? `- Frozen pool snapshot hash: ${economics.poolSnapshotHash}\n` : ""}${economics.notes ? `- Notes: ${economics.notes}\n` : ""}Tier odds:
${tierLines}
Top weighted prize odds:
${prizeLines || "- No prize odds configured."}
Use these exact values if the banner shows price, stock, tier odds, or draw-limit copy. Do not invent stronger money, guaranteed-value, odds, or stock claims than the values above.`;
}

function selectHeroCards(pack: CreativePackInput, payload: ReturnType<typeof normalizeTemplatePayload>) {
  if (payload.heroAssets.length > 0) {
    const selected = payload.heroAssets.slice(0, 5);
    const primary = selected.find((asset) => asset.assetId === payload.primaryHeroAssetId) ?? selected[0];
    return selected.map((asset) => ({
      id: asset.assetId,
      source: asset.source,
      label: asset.displayName,
      imageUrl: asset.imageUrl,
      estimatedValue: 0,
      primary: asset.assetId === primary?.assetId,
      catalogItemId: null,
      catalogSource: null,
      catalogSourceItemId: null,
      snapshotHash: asset.snapshotHash,
      contentHash: asset.contentHash ?? null,
    }));
  }

  const byId = new Map(pack.prizes.map((prize) => [prize.id, prize]));
  const selected = (payload.heroCardIds.length > 0 ? payload.heroCardIds : topPrizes(pack).map((prize) => prize.id))
    .map((id) => byId.get(id))
    .filter((prize): prize is CreativePrizeInput => Boolean(prize))
    .slice(0, 5);
  const fallback = selected.length > 0 ? selected : topPrizes(pack);
  const primary = fallback.find((prize) => prize.id === payload.primaryCardId) ?? fallback[0];
  const privateCreativeStorageUrl = (imageUrl?: string | null) => {
    const raw = String(imageUrl ?? "").trim();
    if (!raw) return null;
    const pathname = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw).pathname
      : raw.split(/[?#]/)[0];
    return pathname.startsWith("/creative-storage/private/") ? raw : null;
  };
  return fallback.map((prize) => ({
    id: prize.id,
    source: "pack_prize" as const,
    label: prize.label,
    imageUrl: privateCreativeStorageUrl(prize.imageLargeUrl) ?? privateCreativeStorageUrl(prize.imageUrl),
    estimatedValue: prize.estimatedValue,
    primary: prize.id === primary?.id,
    catalogItemId: prize.catalogItemId ?? null,
    catalogSource: prize.catalogSource ?? null,
    catalogSourceItemId: prize.catalogSourceItemId ?? null,
  }));
}

export function compileBannerTemplatePrompt(payload: BannerTemplatePayload, pack: CreativePackInput) {
  const normalized = normalizeTemplatePayload(payload);
  const heroCards = selectHeroCards(pack, normalized);
  const packEconomics = summarizePackEconomicsForCreative(pack);
  const primaryCard = heroCards.find((card) => card.primary) ?? heroCards[0];
  const roundSticker = normalized.fields.roundSticker?.trim();
  const claimWarnings = normalized.template.fields
    .filter((field) => field.claimSensitive && normalized.fields[field.key as keyof typeof normalized.fields])
    .map((field) => ({
      fieldKey: field.key,
      text: String(normalized.fields[field.key as keyof typeof normalized.fields] ?? ""),
      requiresReview: true,
    }));

  const templateSeed = normalized.template.promptSeed
    ? `Template prompt-pack source:\n${normalized.template.promptSeed}`
    : "Template prompt-pack source: JP Arcade Guaranteed Hit template.";

  const prompt = `Create a high-energy Japanese online gacha / mystery pack promotional banner for a trading card pack.

${templateSeed}

Use the uploaded/vendor-provided source images as the exact hero art for pack "${pack.title}".
Selected source images: ${heroCards.map((card) => `${card.label} (${card.source})`).join(", ")}.
Keep the uploaded artwork recognizable. Do not invent extra cards, replace uploaded images, or add fake official logos.
Arrange the source images in a premium fan spread across the center-right of the banner. Make the selected primary image the largest and most forward hero prize: ${primaryCard?.label ?? "primary uploaded image"}.

${formatPackEconomicsForPrompt(packEconomics)}

${STYLE_INTENSITY_PROMPTS[normalized.styleIntensity]}

Banner format:
Horizontal mobile web banner, ${normalized.bannerRatio} ratio.
Dense but readable composition designed for high-conversion mobile storefront placement.

Composition:
- Hero prize cards center-right in a dramatic fan spread
- ${MASCOT_PROMPTS[normalized.mascotMode]}
- Gold coins, confetti, lens flares, and rainbow holo reflections
- Big promotional badges along the top
- ${roundSticker ? "Small round sticker near the cards" : "No round sticker if the sticker text is empty"}
- Large bold headline across the bottom
- Strong separation between text and background

Card display:
${CARD_DISPLAY_PROMPTS[normalized.cardDisplayStyle]}
Do not use PSA logos, cert numbers, grading company branding, or specific grade labels unless visible in an uploaded source image.

Text:
Main headline:
"${normalized.fields.headline}"

Top-left badge:
"${normalized.fields.topLeftBadge}"

Top-center badge:
"${normalized.fields.topCenterBadge}"

Top-right badge:
"${normalized.fields.topRightBadge}"
${roundSticker ? `\nSmall round sticker:\n"${roundSticker}"` : ""}

Design requirements:
- Big red/yellow/white outlined Japanese arcade typography
- Thick black shadow behind headline
- Explosive orange/red glow behind hero cards
- Rainbow foil shine around cards
- Premium but chaotic gacha style
- Looks like a high-conversion Japanese mobile card shop promotion
- Text must be readable on mobile
- No clean minimalist design
- No realistic photograph background
- No blurry text
- No fake official logos
- No extra invented prize cards`;

  return {
    template: normalized.template,
    prompt,
    negativePrompt: normalized.template.negativePrompt ?? "No clean SaaS layout. No minimalist corporate design. No fake official logos. No invented cards. No unreadable text. No distorted card faces. No extra cards not uploaded. No cash, profit, or investment wording. No fake cert numbers or fake grading claims.",
    claimWarnings,
    assetManifest: {
      packId: pack.id,
      heroCards,
      primaryCardId: primaryCard?.id ?? null,
      packEconomics,
    },
    options: {
      bannerRatio: normalized.bannerRatio,
      styleIntensity: normalized.styleIntensity,
      mascotMode: normalized.mascotMode,
      cardDisplayStyle: normalized.cardDisplayStyle,
    },
    fields: normalized.fields,
  };
}

export function createBannerTemplateDraftAsset(pack: CreativePackInput, payload: BannerTemplatePayload, compiled: ReturnType<typeof compileBannerTemplatePrompt>) {
  const width = compiled.options.bannerRatio === "3:2" ? 1500 : 1600;
  const height = compiled.options.bannerRatio === "3:2" ? 1000 : 900;
  const accent = compiled.options.styleIntensity === "insane_arcade" ? "#ff2d2d" : compiled.options.styleIntensity === "flashy" ? "#ffb703" : "#ff5f1f";
  const heroCards = compiled.assetManifest.heroCards.map((card, index) => {
    const x = 690 + index * 128;
    const y = card.primary ? 250 : 300;
    const w = card.primary ? 190 : 145;
    const h = card.primary ? 265 : 205;
    const rotate = card.primary ? 0 : index % 2 === 0 ? -10 : 10;
    const image = escapeXml(card.imageUrl ?? "");
    const label = escapeXml(card.label.slice(0, 28));
    const imageNode = image
      ? `<image href="${image}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#171923" stroke="#fff" stroke-width="2"/>`;
    return `<g transform="rotate(${rotate} ${x + w / 2} ${y + h / 2})"><rect x="${x - 12}" y="${y - 12}" width="${w + 24}" height="${h + 54}" rx="24" fill="rgba(255,255,255,0.12)" stroke="#ffe66d" stroke-width="3"/>${imageNode}<text x="${x + w / 2}" y="${y + h + 28}" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="Arial">${label}</text></g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><radialGradient id="bg" cx="52%" cy="42%" r="72%"><stop offset="0%" stop-color="#fff06a"/><stop offset="30%" stop-color="${accent}"/><stop offset="70%" stop-color="#5b1b83"/><stop offset="100%" stop-color="#120816"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="10" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="${width}" height="${height}" fill="url(#bg)"/><circle cx="260" cy="420" r="165" fill="#ffcf33" opacity="0.28" filter="url(#glow)"/><text x="80" y="115" fill="#fff" font-size="34" font-weight="900" font-family="Arial">${escapeXml(compiled.fields.topLeftBadge)}</text><text x="515" y="105" fill="#fff" font-size="34" font-weight="900" font-family="Arial">${escapeXml(compiled.fields.topCenterBadge)}</text><text x="1085" y="105" fill="#ffe66d" font-size="38" font-weight="900" font-family="Arial">${escapeXml(compiled.fields.topRightBadge)}</text><text x="110" y="465" fill="#fff" font-size="42" font-weight="900" font-family="Arial">MASCOT</text>${compiled.fields.roundSticker ? `<circle cx="510" cy="545" r="72" fill="#d90028" stroke="#fff" stroke-width="8"/><text x="510" y="535" fill="#fff" font-size="24" font-weight="900" text-anchor="middle" font-family="Arial">${escapeXml(compiled.fields.roundSticker.slice(0, 12))}</text><text x="510" y="568" fill="#ffe66d" font-size="26" font-weight="900" text-anchor="middle" font-family="Arial">${escapeXml(compiled.fields.roundSticker.slice(12, 28))}</text>` : ""}${heroCards}<rect x="70" y="${height - 210}" width="${width - 140}" height="145" rx="34" fill="rgba(0,0,0,0.76)" stroke="#ffe66d" stroke-width="6"/><text x="${width / 2}" y="${height - 118}" fill="#fff" font-size="72" font-weight="900" text-anchor="middle" font-family="Arial">${escapeXml(compiled.fields.headline)}</text><text x="80" y="${height - 28}" fill="#ffffff" font-size="22" font-family="Arial">MVP manual render candidate. Prompt compiled for GPT Image 2. Private draft only.</text></svg>`;
  const contentHash = crypto.createHash("sha256").update(JSON.stringify({ svg, prompt: compiled.prompt })).digest("hex");
  return {
    title: `${pack.title} banner template draft`,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    targetUrl: `/packs/${pack.id}`,
    contentHash,
    width,
    height,
    metadata: {
      renderer: "oripa-banner-template-mvp-manual-render",
      aiProvider: "none_manual_gpt_image_2_pending",
      templateId: compiled.template.id,
      templateName: compiled.template.name,
      compiledPrompt: compiled.prompt,
      negativePrompt: compiled.negativePrompt,
      fields: compiled.fields,
      options: compiled.options,
      assetManifest: compiled.assetManifest,
      claimWarnings: compiled.claimWarnings,
      providerMode: "manual_or_future_adapter",
    },
  };
}

export function createManualCreativeCandidateAsset(input: {
  creativeJobId: string;
  vendorId: string;
  packId: string;
  candidate: { imageUrl: string; title?: string; width?: number; height?: number; notes?: string };
  candidateIndex: number;
  actorUserId?: string | null;
}) {
  const width = input.candidate.width ?? 1536;
  const height = input.candidate.height ?? 1024;
  const title = input.candidate.title?.trim() || `Manual GPT Image 2 candidate ${input.candidateIndex}`;
  const contentHash = crypto.createHash("sha256").update(JSON.stringify({
    creativeJobId: input.creativeJobId,
    imageUrl: input.candidate.imageUrl,
    candidateIndex: input.candidateIndex,
  })).digest("hex");
  return {
    title,
    imageUrl: input.candidate.imageUrl,
    targetUrl: `/packs/${input.packId}`,
    contentHash,
    width,
    height,
    metadata: {
      renderer: "oripa-manual-render-bridge",
      providerMode: "manual_gpt_image_2",
      aiProvider: "gpt_image_2_manual_upload",
      creativeJobId: input.creativeJobId,
      candidateIndex: input.candidateIndex,
      source: "operator_uploaded_render",
      reviewStatus: "PENDING_REVIEW",
      reviewNotes: input.candidate.notes ?? "",
      uploadedByUserId: input.actorUserId ?? null,
    },
  };
}


export function buildGptImage2GenerationRequest(input: {
  creativeJobId: string;
  prompt: string;
  negativePrompt?: string | null;
  heroCards: Array<{ id: string; label: string; imageUrl?: string | null; primary?: boolean; source?: string }>;
  model?: string;
  imageCount?: number;
}) {
  const prompt = [
    input.prompt,
    input.negativePrompt ? `Negative prompt / hard exclusions:\n${input.negativePrompt}` : "",
  ].filter(Boolean).join("\n\n");
  const images = input.heroCards
    .filter((card) => Boolean(card.imageUrl))
    .slice(0, 5)
    .map((card) => ({ id: card.id, label: card.label, imageUrl: String(card.imageUrl), primary: Boolean(card.primary), source: card.source ?? "unknown" }));
  return {
    model: input.model ?? process.env.ORIPA_GPT_IMAGE_MODEL ?? "gpt-image-2",
    creativeJobId: input.creativeJobId,
    prompt,
    promptHash: crypto.createHash("sha256").update(prompt).digest("hex"),
    images,
    imageCount: Math.min(Math.max(input.imageCount ?? 1, 1), 4),
  };
}

export function createProviderGeneratedCreativeCandidateAsset(input: {
  creativeJobId: string;
  vendorId: string;
  packId: string;
  imageUrl: string;
  contentHash: string;
  width?: number | null;
  height?: number | null;
  promptHash: string;
  providerRequestId?: string | null;
  candidateIndex: number;
}) {
  return {
    title: `Oracle GPT Image 2 candidate ${input.candidateIndex}`,
    imageUrl: input.imageUrl,
    targetUrl: `/packs/${input.packId}`,
    contentHash: input.contentHash,
    width: input.width ?? 1536,
    height: input.height ?? 1024,
    metadata: {
      renderer: "oripa-direct-gpt-image-2",
      providerMode: "direct_gpt_image_2",
      aiProvider: "gpt_image_2",
      creativeJobId: input.creativeJobId,
      candidateIndex: input.candidateIndex,
      source: "provider_generated_render",
      promptHash: input.promptHash,
      providerRequestId: input.providerRequestId ?? null,
      reviewStatus: "PENDING_REVIEW",
      reviewNotes: "",
    },
  };
}

export function markCreativeCandidateReviewed(metadata: unknown, reviewStatus: "APPROVED_PRIVATE" | "REJECTED" | "PENDING_REVIEW", reviewNotes = "", actorUserId?: string | null) {
  const current = typeof metadata === "object" && metadata !== null && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  return {
    ...current,
    reviewStatus,
    reviewNotes,
    reviewedByUserId: actorUserId ?? null,
    reviewedAt: new Date().toISOString(),
  };
}

export function buildPromptBundle(compiled: ReturnType<typeof compileBannerTemplatePrompt>) {
  return {
    templateId: compiled.template.id,
    templateName: compiled.template.name,
    compiledPrompt: compiled.prompt,
    negativePrompt: compiled.negativePrompt,
    fields: compiled.fields,
    options: compiled.options,
    assetManifest: compiled.assetManifest,
    claimWarnings: compiled.claimWarnings,
  };
}

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
  const economics = summarizePackEconomicsForCreative(pack);
  return {
    id: pack.id,
    title: pack.title,
    status: pack.status,
    pricePoints: pack.pricePoints,
    totalStock: pack.totalStock,
    remainingStock: pack.remainingStock,
    startsAt: pack.startsAt ? new Date(pack.startsAt).toISOString() : null,
    endsAt: pack.endsAt ? new Date(pack.endsAt).toISOString() : null,
    notes: economics.notes,
    poolSnapshotHash: economics.poolSnapshotHash,
    drawRules: economics.drawRules,
    tierOdds: economics.tierOdds,
    prizeOdds: economics.prizeOdds,
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

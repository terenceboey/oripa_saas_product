import { z } from "zod";

export { PROMPT_PACK_TEMPLATES, UNIVERSAL_GACHA_NEGATIVE_PROMPT } from "./banner-template-pack";

const imageUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, "Image URL must be an absolute http/https URL");

const privateCreativeStorageImageUrlSchema = z.string().max(4096).refine((value) => {
  const pathname = value.startsWith("/creative-storage/")
    ? value.split(/[?#]/)[0]
    : (() => {
        try {
          const parsed = new URL(value);
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
          return parsed.pathname;
        } catch {
          return "";
        }
      })();
  const decodedPathname = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();
  return decodedPathname.startsWith("/creative-storage/private/") && !decodedPathname.includes("..");
}, "Image URL must be a private creative-storage URL");

const optionalTrimmedStringSchema = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }, z.string().max(maxLength).optional());

const optionalEmailSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().email().max(254).optional());

export const createVendorSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  host: z.string().min(3).max(200),
});

export const updateVendorProfileSchema = z.object({
  name: z.string().min(2).max(80),
});

export const updateVendorLogoSchema = z.object({
  logoImageUrl: imageUrlSchema,
  faviconImageUrl: imageUrlSchema.optional(),
});

export const updateVendorPrefixSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .refine((value) => !value.startsWith("-") && !value.endsWith("-"), {
      message: "Prefix cannot start or end with hyphen",
    }),
});

export const updateVendorBusinessSchema = z.object({
  businessLocation: z.string().max(200).optional().nullable(),
  businessContact: z.string().max(120).optional().nullable(),
});

export const vendorApplicationSchema = z.object({
  entityName: z.string().min(2).max(120),
  yearsOfOperations: z.enum(["LT_1", "ONE_TO_THREE", "THREE_TO_FIVE", "FIVE_PLUS"]),
  personInCharge: z.string().min(2).max(120),
  personInChargeDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  personInChargeCountry: z.string().min(2).max(80),
  identificationDocumentType: z.enum(["PASSPORT", "DRIVING_LICENCE"]),
  identificationDocumentUrl: z.string().url().max(2048).optional().nullable(),
  businessRegistrationNumber: optionalTrimmedStringSchema(120),
  registeredBusinessAddress: optionalTrimmedStringSchema(500),
  contactPhoneNumber: optionalTrimmedStringSchema(40),
  businessEmail: optionalEmailSchema,
  websiteOrSocialLinks: optionalTrimmedStringSchema(2000),
  payoutBankDetails: optionalTrimmedStringSchema(2000),
  applicationStatus: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]).optional(),
});

export const updateVendorReferralSchema = z.object({
  referralCode: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
});

const hexColorSchema = z.string().regex(/^#([A-Fa-f0-9]{6})$/, "Color must be a 6-digit hex like #A1B2C3");
export const updateVendorThemeSchema = z.object({
  storefrontPrimary: hexColorSchema,
  storefrontSecondary: hexColorSchema,
  storefrontAccent: hexColorSchema,
  storefrontSurface: hexColorSchema,
  storefrontText: hexColorSchema,
  storefrontMuted: hexColorSchema,
  storefrontRadius: z.number().int().min(8).max(24),
});

export const updateVendorPlanSchema = z.object({
  planCode: z.enum(["BASIC", "ELITE"]),
});

const catalogPrizeRefSchema = z.object({
  catalogItemId: z.string().min(1).max(120).optional(),
  catalogSource: z.string().min(1).max(80).optional(),
  catalogSourceItemId: z.string().min(1).max(160).optional(),
  language: z.string().min(2).max(12).optional(),
});

const packPrizeItemSchema = catalogPrizeRefSchema.extend({
  label: z.string().min(1).max(60),
  estimatedValue: z.number().int().nonnegative(),
  stock: z.number().int().positive(),
  imageUrl: imageUrlSchema.optional(),
});

const packTierSnapshotItemSchema = z.object({
  label: z.string().min(1).max(60),
  estimatedValue: z.number().int().nonnegative(),
  stock: z.number().int().positive(),
  imageUrl: z.string().max(2048).optional().nullable(),
  catalogItemId: z.string().min(1).max(120).optional().nullable(),
  catalogSource: z.string().min(1).max(80).optional().nullable(),
  catalogSourceItemId: z.string().min(1).max(160).optional().nullable(),
  language: z.string().min(2).max(12).optional().nullable(),
});

const packTierSnapshotTierSchema = z.object({
  name: z.string().min(1).max(40),
  percentage: z.number().positive().max(100).nullable().optional(),
  items: z.array(packTierSnapshotItemSchema).min(1).max(5000),
});

export const packTierSnapshotSchema = z.object({
  version: z.literal(1),
  tiers: z.array(packTierSnapshotTierSchema).min(1).max(10),
});

export const createPackSchema = z.object({
  title: z.string().min(2).max(120),
  packBannerImageUrl: imageUrlSchema.optional(),
  pricePoints: z.number().int().positive(),
  totalStock: z.number().int().positive(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "LIVE"]).optional(),
  importantNotes: z.string().max(2000).optional(),
  drawLimitMode: z.enum(["NONE", "ONCE_PER_CUSTOMER", "DAILY_RESET"]).optional(),
  drawLimitValue: z.number().int().positive().optional(),
  drawLimitResetTimezone: z.string().max(80).optional(),
  isNew: z.boolean().optional().default(true),
  limitedLabel: z.string().min(2).max(80).optional(),
  tiers: z.array(
    z.object({
      name: z.string().min(1).max(40),
      percentage: z.number().positive().max(100).optional(),
      items: z.array(packPrizeItemSchema).min(1).max(5000),
    })
  ).min(1).max(10).optional(),
  prizes: z.array(
    packPrizeItemSchema.extend({
      weight: z.number().int().positive(),
    })
  ).min(1).max(5000).optional(),
});

export const updatePackSchema = createPackSchema.partial().extend({
  title: z.string().min(2).max(120).optional(),
});

export const drawSchema = z.object({
  packId: z.string().cuid(),
  quantity: z.number().int().min(1).max(5000).default(1),
});

export const createBannerSchema = z.object({
  title: z.string().min(2).max(80),
  imageUrl: imageUrlSchema,
  targetUrl: z.string().url().optional(),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const campaignCreativeStyleSchema = z.enum([
  "premium_foil",
  "neon_arcade",
  "dark_luxury",
  "clean_showcase",
]);

export const bannerTemplateIdSchema = z.string().min(1).max(120);
export const bannerRatioSchema = z.enum(["3:2", "16:9"]);
export const bannerStyleIntensitySchema = z.enum(["flashy", "ultra_flashy", "insane_arcade"]);
export const bannerMascotModeSchema = z.enum(["primary_card_inspired", "lucky_arcade_host", "no_mascot"]);
export const bannerCardDisplayStyleSchema = z.enum([
  "auto",
  "raw_cards",
  "glossy_card_frames",
  "generic_graded_slabs",
  "real_slab_only",
]);

const creativeHeroAssetSchema = z.object({
  assetId: z.string().min(1).max(160),
  source: z.enum(["upload", "pack_prize"]),
  imageUrl: privateCreativeStorageImageUrlSchema,
  displayName: z.string().min(1).max(120),
  snapshotHash: z.string().min(8).max(128),
  contentHash: z.string().min(8).max(128).optional(),
});

export const createCampaignCreativeSchema = z.object({
  templateId: bannerTemplateIdSchema.optional().default("jp_arcade_guaranteed_hit_v1"),
  stylePreset: campaignCreativeStyleSchema.optional().default("neon_arcade"),
  aspectRatio: z.enum(["16:9", "1:1", "4:5", "3:2"]).optional().default("3:2"),
  bannerRatio: bannerRatioSchema.optional().default("3:2"),
  styleIntensity: bannerStyleIntensitySchema.optional().default("ultra_flashy"),
  mascotMode: bannerMascotModeSchema.optional().default("primary_card_inspired"),
  cardDisplayStyle: bannerCardDisplayStyleSchema.optional().default("auto"),
  heroCardIds: z.array(z.string().min(1)).min(1).max(5).optional(),
  primaryCardId: z.string().min(1).optional(),
  heroAssets: z.array(creativeHeroAssetSchema).min(1).max(5).optional(),
  primaryHeroAssetId: z.string().min(1).optional(),
  fields: z.object({
    headline: z.string().min(2).max(64),
    topLeftBadge: z.string().max(64),
    topCenterBadge: z.string().max(64),
    topRightBadge: z.string().max(48),
    roundSticker: z.string().max(40).optional().default(""),
  }).optional(),
}).refine((value) => Boolean(value.heroAssets?.length || value.heroCardIds?.length), {
  message: "Choose uploaded source assets or pack-prize hero cards",
  path: ["heroAssets"],
});

export const createGptImage2CreativeGenerationSchema = z.object({
  imageCount: z.number().int().min(1).max(4).optional().default(1),
});

export const publishCampaignCreativeSchema = z.object({
  assetId: z.string().cuid(),
});

export const createManualCreativeCandidatesSchema = z.object({
  candidates: z.array(z.object({
    imageUrl: privateCreativeStorageImageUrlSchema,
    title: z.string().min(2).max(120).optional(),
    width: z.number().int().min(320).max(4096).optional().default(1536),
    height: z.number().int().min(320).max(4096).optional().default(1024),
    notes: z.string().max(500).optional().default(""),
  })).min(1).max(4),
});

export const reviewCreativeAssetSchema = z.object({
  reviewStatus: z.enum(["APPROVED_PRIVATE", "REJECTED", "PENDING_REVIEW"]),
  reviewNotes: z.string().max(500).optional().default(""),
});

export const updateVendorLimitsSchema = z.object({
  maxPackItems: z.number().int().min(1).max(5000).optional(),
  maxDrawQuantity: z.number().int().min(1).max(5000).optional(),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;
export type UpdateVendorLogoInput = z.infer<typeof updateVendorLogoSchema>;
export type UpdateVendorPrefixInput = z.infer<typeof updateVendorPrefixSchema>;
export type UpdateVendorBusinessInput = z.infer<typeof updateVendorBusinessSchema>;
export type VendorApplicationInput = z.infer<typeof vendorApplicationSchema>;
export type UpdateVendorReferralInput = z.infer<typeof updateVendorReferralSchema>;
export type UpdateVendorThemeInput = z.infer<typeof updateVendorThemeSchema>;
export type UpdateVendorPlanInput = z.infer<typeof updateVendorPlanSchema>;
export type CreatePackInput = z.infer<typeof createPackSchema>;
export type UpdatePackInput = z.infer<typeof updatePackSchema>;
export type PackTierSnapshot = z.infer<typeof packTierSnapshotSchema>;
export type DrawInput = z.infer<typeof drawSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type CreateCampaignCreativeInput = z.infer<typeof createCampaignCreativeSchema>;
export type PublishCampaignCreativeInput = z.infer<typeof publishCampaignCreativeSchema>;
export type CreateGptImage2CreativeGenerationInput = z.infer<typeof createGptImage2CreativeGenerationSchema>;
export type CreateManualCreativeCandidatesInput = z.infer<typeof createManualCreativeCandidatesSchema>;
export type ReviewCreativeAssetInput = z.infer<typeof reviewCreativeAssetSchema>;
export type UpdateVendorLimitsInput = z.infer<typeof updateVendorLimitsSchema>;

import { z } from "zod";

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

const packBannerImageUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("/")) return true;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, "Pack banner must be a relative path or an absolute http/https URL");

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

export const vendorThemePresetIds = [
  "lavender-dawn",
  "mint-cloud",
  "peach-sorbet",
  "sky-bloom",
  "rose-mist",
  "midnight-prism",
  "cosmic-violet",
  "emerald-night",
  "pearl-aurora",
  "champagne-glow",
  "frosted-orchid",
] as const;
export const vendorThemePresetSchema = z.enum(vendorThemePresetIds);

export const vendorDrawAnimationPresetIds = [
  "reel",
  "wheel",
  "flip",
] as const;
export const vendorDrawAnimationPresetSchema = z.enum(vendorDrawAnimationPresetIds);

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
  registeredBusinessAddressLine1: optionalTrimmedStringSchema(120),
  registeredBusinessAddressLine2: optionalTrimmedStringSchema(120),
  registeredBusinessAddressCity: optionalTrimmedStringSchema(120),
  registeredBusinessAddressStateProvince: optionalTrimmedStringSchema(120),
  registeredBusinessAddressPostalCode: optionalTrimmedStringSchema(40),
  registeredBusinessAddressCountry: optionalTrimmedStringSchema(80),
  contactPhoneNumber: optionalTrimmedStringSchema(40),
  businessEmail: optionalEmailSchema,
  businessWebsiteUrl: z.string().url().max(2048).optional().nullable(),
  facebookUrl: z.string().url().max(2048).optional().nullable(),
  instagramUrl: z.string().url().max(2048).optional().nullable(),
  tiktokUrl: z.string().url().max(2048).optional().nullable(),
  xUrl: z.string().url().max(2048).optional().nullable(),
  linkedinUrl: z.string().url().max(2048).optional().nullable(),
  youtubeUrl: z.string().url().max(2048).optional().nullable(),
  payoutBankAccountHolderName: optionalTrimmedStringSchema(120),
  payoutBankName: optionalTrimmedStringSchema(120),
  payoutBankCountry: optionalTrimmedStringSchema(80),
  payoutBankAccountNumber: optionalTrimmedStringSchema(120),
  payoutBankIban: optionalTrimmedStringSchema(120),
  payoutBankSwiftBic: optionalTrimmedStringSchema(120),
  payoutBankBranchCode: optionalTrimmedStringSchema(80),
  applicationStatus: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]).optional(),
});

export const updateVendorReferralSchema = z.object({
  referralCode: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
});

const hexColorSchema = z.string().regex(/^#([A-Fa-f0-9]{6})$/, "Color must be a 6-digit hex like #A1B2C3");
export const updateVendorThemeSchema = z.object({
  storefrontThemePreset: vendorThemePresetSchema.optional().nullable(),
  drawAnimationPreset: vendorDrawAnimationPresetSchema.optional().nullable(),
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

const optionalPackPrizeStockSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Number(trimmed);
  }
  return value;
}, z.number().int().positive().default(1));

const packPrizeItemSchema = catalogPrizeRefSchema.extend({
  label: z.string().min(1).max(60),
  estimatedValue: z.number().int().nonnegative(),
  stock: optionalPackPrizeStockSchema.optional(),
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
  packBannerImageUrl: packBannerImageUrlSchema.optional(),
  packCoverImageUrl: packBannerImageUrlSchema.optional(),
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

export const walletTopupSchema = z.object({
  amountPoints: z.number().int().positive().max(100000),
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

export const createCampaignCreativeSchema = z.object({
  stylePreset: campaignCreativeStyleSchema.optional().default("premium_foil"),
  aspectRatio: z.enum(["16:9", "1:1", "4:5"]).optional().default("16:9"),
});

export const publishCampaignCreativeSchema = z.object({
  assetId: z.string().cuid(),
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
export type WalletTopupInput = z.infer<typeof walletTopupSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type CreateCampaignCreativeInput = z.infer<typeof createCampaignCreativeSchema>;
export type PublishCampaignCreativeInput = z.infer<typeof publishCampaignCreativeSchema>;
export type UpdateVendorLimitsInput = z.infer<typeof updateVendorLimitsSchema>;

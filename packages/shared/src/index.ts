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

export const createVendorSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  host: z.string().min(3).max(200),
});

export const updateVendorProfileSchema = z.object({
  name: z.string().min(2).max(80),
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
      items: z.array(
        z.object({
          label: z.string().min(1).max(60),
          estimatedValue: z.number().int().nonnegative(),
          stock: z.number().int().positive(),
          imageUrl: imageUrlSchema.optional(),
        })
      ).min(1).max(5000),
    })
  ).min(1).max(10).optional(),
  prizes: z.array(
    z.object({
      label: z.string().min(1).max(60),
      estimatedValue: z.number().int().nonnegative(),
      weight: z.number().int().positive(),
      stock: z.number().int().positive(),
      imageUrl: imageUrlSchema.optional(),
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

export const updateVendorLimitsSchema = z.object({
  maxPackItems: z.number().int().min(1).max(5000).optional(),
  maxDrawQuantity: z.number().int().min(1).max(5000).optional(),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;
export type UpdateVendorPrefixInput = z.infer<typeof updateVendorPrefixSchema>;
export type UpdateVendorBusinessInput = z.infer<typeof updateVendorBusinessSchema>;
export type UpdateVendorReferralInput = z.infer<typeof updateVendorReferralSchema>;
export type UpdateVendorThemeInput = z.infer<typeof updateVendorThemeSchema>;
export type UpdateVendorPlanInput = z.infer<typeof updateVendorPlanSchema>;
export type CreatePackInput = z.infer<typeof createPackSchema>;
export type UpdatePackInput = z.infer<typeof updatePackSchema>;
export type DrawInput = z.infer<typeof drawSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateVendorLimitsInput = z.infer<typeof updateVendorLimitsSchema>;

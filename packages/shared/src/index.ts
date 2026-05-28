import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  host: z.string().min(3).max(200),
});

export const updateVendorProfileSchema = z.object({
  name: z.string().min(2).max(80),
});

export const updateVendorBusinessSchema = z.object({
  businessLocation: z.string().max(200).optional().nullable(),
  businessContact: z.string().max(120).optional().nullable(),
});

export const updateVendorReferralSchema = z.object({
  referralCode: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
});

export const updateVendorPlanSchema = z.object({
  planCode: z.enum(["BASIC", "ELITE"]),
});

export const createPackSchema = z.object({
  title: z.string().min(2).max(120),
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
          imageUrl: z.string().url().optional(),
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
      imageUrl: z.string().url().optional(),
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
  imageUrl: z.string().url(),
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
export type UpdateVendorBusinessInput = z.infer<typeof updateVendorBusinessSchema>;
export type UpdateVendorReferralInput = z.infer<typeof updateVendorReferralSchema>;
export type UpdateVendorPlanInput = z.infer<typeof updateVendorPlanSchema>;
export type CreatePackInput = z.infer<typeof createPackSchema>;
export type UpdatePackInput = z.infer<typeof updatePackSchema>;
export type DrawInput = z.infer<typeof drawSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateVendorLimitsInput = z.infer<typeof updateVendorLimitsSchema>;

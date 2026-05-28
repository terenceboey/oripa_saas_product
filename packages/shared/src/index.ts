import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  host: z.string().min(3).max(200),
});

export const updateVendorProfileSchema = z.object({
  name: z.string().min(2).max(80),
});

export const createPackSchema = z.object({
  title: z.string().min(2).max(120),
  pricePoints: z.number().int().positive(),
  totalStock: z.number().int().positive(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
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
export type CreatePackInput = z.infer<typeof createPackSchema>;
export type DrawInput = z.infer<typeof drawSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateVendorLimitsInput = z.infer<typeof updateVendorLimitsSchema>;

import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  host: z.string().min(3).max(200),
});

export const createPackSchema = z.object({
  title: z.string().min(2).max(120),
  pricePoints: z.number().int().positive(),
  totalStock: z.number().int().positive(),
});

export const drawSchema = z.object({
  packId: z.string().cuid(),
  quantity: z.number().int().min(1).max(100).default(1),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreatePackInput = z.infer<typeof createPackSchema>;
export type DrawInput = z.infer<typeof drawSchema>;

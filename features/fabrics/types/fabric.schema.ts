import { z } from 'zod';

/** Validation for creating/updating fabric records via the API. */
export const fabricCreateSchema = z.object({
  mill_id: z.string().uuid(),
  fabric_code: z.string().min(1).max(64),
  fabric_name: z.string().max(200).nullish(),
  fabric_type: z.string().max(100).nullish(),
  composition: z.string().max(200).nullish(),
  gsm: z.coerce.number().int().min(1).max(2000).nullish(),
  width: z.string().max(100).nullish(),
  color: z.string().max(100).nullish(),
  color_family: z.string().max(50).nullish(),
  season: z.string().max(50).nullish(),
  description: z.string().max(4000).nullish(),
  ai_description: z.string().max(4000).nullish(),
  suggested_use: z.string().max(1000).nullish(),
  extraction_confidence: z.coerce.number().min(0).max(100).nullish(),
  review_status: z.enum(['approved', 'needs_review', 'rejected']).optional(),
});

export const fabricUpdateSchema = fabricCreateSchema.partial();

export const fabricSearchSchema = z.object({
  q: z.string().max(200).optional(),
  millSlug: z.string().max(100).optional(),
  fabricType: z.string().max(100).optional(),
  colorFamily: z.string().max(50).optional(),
  composition: z.string().max(200).optional(),
  gsmMin: z.coerce.number().int().min(0).optional(),
  gsmMax: z.coerce.number().int().max(5000).optional(),
  reviewStatus: z.enum(['approved', 'needs_review', 'rejected']).optional(),
  sort: z.enum(['newest', 'gsm_asc', 'gsm_desc', 'code']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type FabricCreateInput = z.infer<typeof fabricCreateSchema>;
export type FabricUpdateInput = z.infer<typeof fabricUpdateSchema>;

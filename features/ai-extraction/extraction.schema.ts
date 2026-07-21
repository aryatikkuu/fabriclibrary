import { z } from 'zod';

/**
 * Contract for AI output. Nothing enters the database until it passes this
 * schema — free-form model output is never trusted directly.
 */
export const extractionResultSchema = z.object({
  mill_name: z.string().default(''),
  fabric_code: z.string().default(''),
  fabric_name: z.string().default(''),
  fabric_type: z.string().default(''),
  composition: z.string().default(''),
  gsm: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => {
      if (v === null || v === '') return null;
      const n = typeof v === 'string' ? parseInt(v.replace(/[^\d]/g, ''), 10) : v;
      return Number.isFinite(n) && n > 0 && n <= 2000 ? Math.round(n) : null;
    })
    .default(null),
  width: z.string().default(''),
  color: z.string().default(''),
  color_family: z.string().default(''),
  season: z.string().default(''),
  suggested_use: z.string().default(''),
  use_tags: z.array(z.string()).default([]),
  technical_notes: z.string().default(''),
  confidence_score: z.coerce.number().min(0).max(100).default(0),
  missing_fields: z.array(z.string()).default([]),
  extraction_notes: z.string().default(''),
});

export type ValidatedExtraction = z.infer<typeof extractionResultSchema>;

/** Fields that matter most; used to recompute missing_fields defensively. */
export const CORE_EXTRACTION_FIELDS = [
  'mill_name',
  'fabric_code',
  'fabric_type',
  'composition',
  'gsm',
  'width',
  'color',
] as const;

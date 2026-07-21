import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildServices } from '@/lib/container';
import { handleApiError, verifyWebhookSecret } from '@/lib/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

const ingestSchema = z.object({
  filename: z.string().min(1),
  image_base64: z.string().min(50),
  mime_type: z.string().default('image/jpeg'),
  /** Optional override if the operator already knows the mill. */
  mill_slug: z.string().optional(),
});

/**
 * POST /api/ingest — the full ingestion pipeline in one call, used by n8n:
 * extract → resolve mill → upload to Storage → save fabric → log → similars.
 * Auth: x-webhook-secret header only (service-role context).
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyWebhookSecret(request)) throw new UnauthorizedError('Invalid webhook secret');

    const body = ingestSchema.parse(await request.json());
    const db = createAdminClient();
    const {
      extractionService,
      millService,
      storageService,
      similarityService,
      repositories: { fabricRepository, extractionLogRepository },
    } = buildServices(db);

    // 1. AI extraction.
    let outcome;
    try {
      outcome = await extractionService.extractFromBase64(body.image_base64, body.mime_type);
    } catch (error) {
      await extractionLogRepository.insert({
        source_image_path: body.filename,
        extraction_status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    const r = outcome.result;

    // 2. Resolve mill (override > extracted name > unassigned fallback).
    const mill = body.mill_slug
      ? await millService.getBySlug(body.mill_slug)
      : await millService.resolveByName(r.mill_name);
    if (!mill) {
      await extractionLogRepository.insert({
        source_image_path: body.filename,
        raw_ai_response: outcome.raw,
        extracted_json: r,
        confidence_score: r.confidence_score,
        extraction_status: 'failed',
        error_message: `Could not resolve mill from "${r.mill_name}"`,
      });
      return NextResponse.json(
        { error: { code: 'MILL_NOT_RESOLVED', message: `Unknown mill "${r.mill_name}"`, extraction: r } },
        { status: 422 },
      );
    }

    // 3. Upload image to Storage.
    const fabricCode = r.fabric_code || `UNCODED-${Date.now()}`;
    const buffer = Buffer.from(body.image_base64.replace(/^data:[^,]+,/, ''), 'base64');
    const uploaded = await storageService.uploadImage(
      mill.slug, fabricCode, body.filename, buffer, body.mime_type,
    );

    // 4. Save fabric record (upsert on mill + code).
    const existing = await fabricRepository.findByCode(fabricCode);
    const reviewStatus = outcome.needsReview ? 'needs_review' : 'approved';
    const fabricFields = {
      mill_id: mill.id,
      fabric_code: fabricCode,
      fabric_name: r.fabric_name || null,
      fabric_type: r.fabric_type || null,
      composition: r.composition || null,
      gsm: r.gsm,
      width: r.width || null,
      color: r.color || null,
      color_family: r.color_family || null,
      season: r.season || null,
      suggested_use: r.suggested_use || null,
      ai_description: r.technical_notes || null,
      extraction_confidence: r.confidence_score,
      review_status: reviewStatus as 'approved' | 'needs_review',
    };
    const fabric = existing && existing.mill_id === mill.id
      ? await fabricRepository.update(existing.id, fabricFields)
      : await fabricRepository.create(fabricFields);

    // 5. Attach image.
    await fabricRepository.addImage({
      fabric_id: fabric.id,
      storage_path: uploaded.storagePath,
      public_url: uploaded.publicUrl,
      image_type: 'hanger',
      is_primary: true,
    });

    // 6. Extraction log.
    await extractionLogRepository.insert({
      fabric_id: fabric.id,
      source_image_path: uploaded.storagePath,
      raw_ai_response: outcome.raw,
      extracted_json: r,
      confidence_score: r.confidence_score,
      extraction_status: outcome.status,
    });

    // 7. Similar fabrics.
    await similarityService.recalculateForFabric(fabric.id);

    return NextResponse.json({
      fabric_id: fabric.id,
      fabric_code: fabric.fabric_code,
      mill: mill.slug,
      review_status: fabric.review_status,
      confidence: r.confidence_score,
      needs_review: outcome.needsReview,
      image_url: uploaded.publicUrl,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

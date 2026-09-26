import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requirePermission, verifyWebhookSecret } from '@/lib/api-helpers';
import { AIExtractionService } from '@/features/ai-extraction/extraction.service';
import { MAX_IMAGE_BYTES, decodeBase64Image } from '@/lib/images';

export const dynamic = 'force-dynamic';

const extractRequestSchema = z
  .object({
    image_url: z.string().url().optional(),
    image_base64: z.string().min(50).max(Math.ceil(MAX_IMAGE_BYTES * 1.4)).optional(),
  })
  .refine((v) => v.image_url || v.image_base64, {
    message: 'Provide image_url or image_base64',
  });

/**
 * POST /api/ai-extraction/extract — run AI extraction on one image.
 * Auth: signed-in editor/admin, OR x-webhook-secret header (n8n).
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyWebhookSecret(request)) {
      await requirePermission('fabrics.create');
    }

    const body = extractRequestSchema.parse(await request.json());
    const extraction = new AIExtractionService();

    // image_url is fetched by OpenAI, not by this server (no SSRF); base64 is checked here.
    let outcome;
    if (body.image_url) {
      outcome = await extraction.extractFromImageUrl(body.image_url);
    } else {
      const image = decodeBase64Image(body.image_base64!);
      outcome = await extraction.extractFromBase64(image.bytes.toString('base64'), image.type);
    }

    return NextResponse.json({
      extraction: outcome.result,
      needs_review: outcome.needsReview,
      status: outcome.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

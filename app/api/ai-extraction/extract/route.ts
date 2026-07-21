import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requirePermission, verifyWebhookSecret } from '@/lib/api-helpers';
import { AIExtractionService } from '@/features/ai-extraction/extraction.service';

const extractRequestSchema = z
  .object({
    image_url: z.string().url().optional(),
    image_base64: z.string().min(50).optional(),
    mime_type: z.string().default('image/jpeg'),
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

    const outcome = body.image_url
      ? await extraction.extractFromImageUrl(body.image_url)
      : await extraction.extractFromBase64(body.image_base64!, body.mime_type);

    return NextResponse.json({
      extraction: outcome.result,
      needs_review: outcome.needsReview,
      status: outcome.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

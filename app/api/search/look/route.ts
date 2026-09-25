import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission, requireRateLimit } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { readLook } from '@/features/look-search/read-look';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // the browser shrinks photos to ~200 KB first
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** End-use tags change only when the library is re-tagged; refresh hourly. */
let useTagCache: { tags: string[]; at: number } | null = null;

/**
 * POST /api/search/look — signed-in users only (each call costs ~0.1–0.2¢).
 * Multipart fields: image (optional), note (optional, "for summer shirts").
 * Returns { look, description }; the search page ranks fabrics from `look`.
 * The photo is only forwarded to OpenAI — never stored.
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission('fabrics.read');
    requireRateLimit(request);

    const form = await request.formData();
    const image = form.get('image');
    const note = String(form.get('note') ?? '').trim().slice(0, 200);

    let imageDataUrl: string | null = null;
    if (image instanceof File && image.size > 0) {
      if (!IMAGE_TYPES.includes(image.type)) throw new ValidationError('Use a JPEG, PNG or WebP photo');
      if (image.size > MAX_IMAGE_BYTES) throw new ValidationError('Photo is too large (max 4 MB)');
      imageDataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString('base64')}`;
    }
    if (!imageDataUrl && !note) throw new ValidationError('Add a photo or describe what you need');

    if (!useTagCache || Date.now() - useTagCache.at > 3_600_000) {
      const { repositories } = buildServices(await createClient());
      useTagCache = { tags: await repositories.fabricRepository.popularUseTags(), at: Date.now() };
    }

    return NextResponse.json(await readLook({ imageDataUrl, note, useTags: useTagCache.tags }));
  } catch (error) {
    return handleApiError(error);
  }
}

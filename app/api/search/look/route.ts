import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { getCurrentProfile, handleApiError } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { validateImage } from '@/lib/images';
import { readLook } from '@/features/look-search/read-look';
import { embedLookDescription } from '@/features/look-search/embed-look';
import { claimLookSearch, saveLookResult } from '@/features/look-search/look-quota';

export const dynamic = 'force-dynamic';

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // the browser shrinks photos to ~200 KB first

/** End-use tags change only when the library is re-tagged; refresh hourly. */
let useTagCache: { tags: string[]; at: number } | null = null;

/**
 * POST /api/search/look — open to everyone, within daily limits (each call
 * costs ~0.14¢; limits in lookSearch.limits, enforced by claim_look_search).
 * Multipart fields: image (optional), note (optional, "for summer shirts").
 * Returns { look, description, lookId }; the search page ranks fabrics from
 * `look` plus the description embedding stored under `lookId`.
 * The photo is only forwarded to OpenAI — never stored.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get('image');
    const note = String(form.get('note') ?? '').trim().slice(0, 200);

    let imageDataUrl: string | null = null;
    if (image instanceof File && image.size > 0) {
      const bytes = Buffer.from(await image.arrayBuffer());
      imageDataUrl = `data:${validateImage(bytes, MAX_PHOTO_BYTES)};base64,${bytes.toString('base64')}`;
    }
    if (!imageDataUrl && !note) throw new ValidationError('Add a photo or describe what you need');

    // Reserve a search before spending anything; throws 429 when over a limit
    // (bursts, per visitor/user, or all visitors together — see claim_look_search).
    const lookId = await claimLookSearch(request, await getCurrentProfile());

    if (!useTagCache || Date.now() - useTagCache.at > 3_600_000) {
      const { repositories } = buildServices(await createClient());
      useTagCache = { tags: await repositories.fabricRepository.popularUseTags(), at: Date.now() };
    }

    const { look, description } = await readLook({ imageDataUrl, note, useTags: useTagCache.tags });
    await saveLookResult(lookId, { look, description, embedding: await embedLookDescription(description) });
    return NextResponse.json({ look, description, lookId });
  } catch (error) {
    return handleApiError(error);
  }
}

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
 * Returns { look, description, lookId, code }; the search page ranks fabrics from
 * `look` plus the description embedding stored under `lookId`. `code` is set only
 * when the photo's label shows a fabric code that exists in the library — the
 * client then searches by that code instead (same AI call, no extra cost).
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

    const services = buildServices(await createClient());
    if (!useTagCache || Date.now() - useTagCache.at > 3_600_000) {
      useTagCache = { tags: await services.repositories.fabricRepository.popularUseTags(), at: Date.now() };
    }

    const { look, description, code } = await readLook({ imageDataUrl, note, useTags: useTagCache.tags });
    await saveLookResult(lookId, { look, description, embedding: await embedLookDescription(description) });
    // The label's code only counts if a fabric the visitor can see has it.
    const found = code && (await services.fabricService.search({ q: code, pageSize: 1 })).total > 0 ? code : null;
    return NextResponse.json({ look, description, lookId, code: found });
  } catch (error) {
    return handleApiError(error);
  }
}

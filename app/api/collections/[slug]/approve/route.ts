import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';
import { findCollection } from '@/lib/config/collections.config';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** POST /api/collections/:slug/approve — approve every pending swatch of a collection. */
export async function POST(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const profile = await requirePermission('review.approve');
    if (!findCollection(params.slug)) throw new NotFoundError('Collection', params.slug);
    const { reviewService } = buildServices(await createClient());
    const approved = await reviewService.approveCollection(params.slug, profile.id);
    return NextResponse.json({ approved });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';

/** POST /api/review-queue/:id/rerun — re-run AI extraction on the fabric image. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await requirePermission('review.rerun');
    const { reviewService } = buildServices(await createClient());
    const fabric = await reviewService.rerunExtraction(params.id, profile.id);
    return NextResponse.json(fabric);
  } catch (error) {
    return handleApiError(error);
  }
}

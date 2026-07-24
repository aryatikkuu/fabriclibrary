import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** PATCH /api/review-queue/:id/reject — reject a record. */
export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await requirePermission('review.reject');
    const { reviewService } = buildServices(await createClient());
    const fabric = await reviewService.reject(params.id, profile.id);
    return NextResponse.json(fabric);
  } catch (error) {
    return handleApiError(error);
  }
}

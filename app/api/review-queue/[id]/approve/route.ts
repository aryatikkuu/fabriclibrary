import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';
import { fabricUpdateSchema } from '@/features/fabrics/types/fabric.schema';

/** PATCH /api/review-queue/:id/approve — approve a record, with optional corrections. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await requirePermission('review.approve');
    const corrections = fabricUpdateSchema.parse(await request.json().catch(() => ({})));
    const { reviewService, similarityService } = buildServices(await createClient());
    const fabric = await reviewService.approve(params.id, corrections, profile.id);
    await similarityService.recalculateForFabric(params.id);
    return NextResponse.json(fabric);
  } catch (error) {
    return handleApiError(error);
  }
}

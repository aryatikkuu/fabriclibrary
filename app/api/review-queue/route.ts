import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/review-queue — fabrics awaiting human review (admin/editor). */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('review.read');
    const page = Number(request.nextUrl.searchParams.get('page') ?? 1);
    const { reviewService } = buildServices(await createClient());
    const queue = await reviewService.getQueue(page);
    return NextResponse.json(queue);
  } catch (error) {
    return handleApiError(error);
  }
}

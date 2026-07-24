import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission, requireRateLimit } from '@/lib/api-helpers';
import { fabricSearchSchema, fabricCreateSchema } from '@/features/fabrics/types/fabric.schema';

export const dynamic = 'force-dynamic';

/** GET /api/fabrics — list and search fabrics. */
export async function GET(request: NextRequest) {
  try {
    const params = fabricSearchSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const { fabricService } = buildServices(await createClient());
    const result = await fabricService.search(params);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/fabrics — create a fabric (admin/editor). */
export async function POST(request: NextRequest) {
  try {
    requireRateLimit(request);
    const profile = await requirePermission('fabrics.create');
    const body = fabricCreateSchema.parse(await request.json());
    const { fabricService, similarityService } = buildServices(await createClient());
    const fabric = await fabricService.create({ ...body }, profile.id);
    await similarityService.recalculateForFabric(fabric.id);
    return NextResponse.json(fabric, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

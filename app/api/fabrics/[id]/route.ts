import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';
import { fabricUpdateSchema } from '@/features/fabrics/types/fabric.schema';

export const dynamic = 'force-dynamic';

type Context = { params: { id: string } };

/** GET /api/fabrics/:id — fabric details. */
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { fabricService } = buildServices(await createClient());
    const fabric = await fabricService.getById(params.id);
    return NextResponse.json(fabric);
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/fabrics/:id — update a fabric (admin/editor). */
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const profile = await requirePermission('fabrics.update');
    const body = fabricUpdateSchema.parse(await request.json());
    const { fabricService, similarityService } = buildServices(await createClient());
    const fabric = await fabricService.update(params.id, body, profile.id);
    await similarityService.recalculateForFabric(params.id);
    return NextResponse.json(fabric);
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/fabrics/:id — delete a fabric (admin only). */
export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const profile = await requirePermission('fabrics.delete');
    const { fabricService } = buildServices(await createClient());
    await fabricService.remove(params.id, profile.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

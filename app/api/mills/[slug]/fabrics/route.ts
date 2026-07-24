import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError } from '@/lib/api-helpers';
import { fabricSearchSchema } from '@/features/fabrics/types/fabric.schema';

export const dynamic = 'force-dynamic';

/** GET /api/mills/:slug/fabrics — fabrics belonging to one mill. */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const query = fabricSearchSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const { fabricService } = buildServices(await createClient());
    const result = await fabricService.search({ ...query, millSlug: params.slug });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

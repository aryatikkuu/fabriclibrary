import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/fabrics/:id/similar — top similar fabrics. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { similarityService } = buildServices(await createClient());
    const similar = await similarityService.getTopSimilar(params.id);
    return NextResponse.json(similar);
  } catch (error) {
    return handleApiError(error);
  }
}

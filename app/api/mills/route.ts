import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError } from '@/lib/api-helpers';

/** GET /api/mills — active mills with fabric counts. */
export async function GET() {
  try {
    const { millService } = buildServices(await createClient());
    const mills = await millService.listWithCounts();
    return NextResponse.json(mills);
  } catch (error) {
    return handleApiError(error);
  }
}

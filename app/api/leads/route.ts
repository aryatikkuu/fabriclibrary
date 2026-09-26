import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildServices } from '@/lib/container';
import { handleApiError } from '@/lib/api-helpers';
import { AppError } from '@/lib/errors';
import { appConfig } from '@/lib/config/app.config';
import { requestVisitor } from '@/lib/visitor';
import { leadSchema } from '@/features/leads/lead';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads — save a "Request swatches / price" submission (anyone).
 * The buyer's email app then opens a pre-filled draft (built client-side by
 * leadMailto); this row is the record the analytics page reads.
 * JSON: { fabricId, request, name, email, company?, whatsapp?, message? }
 */
export async function POST(request: NextRequest) {
  try {
    const lead = leadSchema.parse(await request.json());
    if (lead.website) return NextResponse.json({ ok: true }); // honeypot: bots get a quiet success

    // Only fabrics the visitor can see (RLS: approved, or any for staff).
    const fabric = await buildServices(await createClient()).fabricService.getById(lead.fabricId);

    const db = createAdminClient();
    const clientKey = requestVisitor(request);
    const { count, error: countError } = await db
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('client_key', clientKey)
      .gt('created_at', new Date(Date.now() - 86_400_000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= appConfig.leads.perVisitorPerDay) {
      throw new AppError('Too many requests today. Please email us directly.', 429, 'LEAD_LIMIT');
    }

    const { error } = await db.from('leads').insert({
      fabric_id: fabric.id,
      fabric_code: fabric.fabric_code,
      mill_id: fabric.mill?.id ?? null,
      request: lead.request,
      name: lead.name,
      company: lead.company ?? null,
      whatsapp: lead.whatsapp ?? null,
      email: lead.email,
      message: lead.message ?? null,
      client_key: clientKey,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

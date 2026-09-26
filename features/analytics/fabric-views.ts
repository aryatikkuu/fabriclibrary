import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { headersVisitor, isBot } from '@/lib/visitor';

/**
 * Count a fabric page view for the analytics page: at most one per fabric,
 * per visitor, per day (fabric_views, migration 0011). Staff and bots (link
 * previews, crawlers) aren't counted. Never fails the page.
 */
export async function recordFabricView(fabricId: string, isStaff: boolean): Promise<void> {
  if (isStaff) return;
  const requestHeaders = headers();
  if (isBot(requestHeaders.get('user-agent'))) return;
  const { error } = await createAdminClient()
    .from('fabric_views')
    .upsert(
      { fabric_id: fabricId, visitor: headersVisitor(requestHeaders) },
      { onConflict: 'fabric_id,viewed_on,visitor', ignoreDuplicates: true },
    );
  if (error) console.error('recordFabricView failed:', error.message);
}

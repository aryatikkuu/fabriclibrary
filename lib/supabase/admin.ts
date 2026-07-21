import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS — server-only, used by automation
 * endpoints (n8n ingestion) and trusted server routes. Never import from
 * client components.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

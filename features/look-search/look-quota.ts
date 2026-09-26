import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';
import { lookSearch } from '@/lib/config/visual-tags.config';
import type { Profile } from '@/types/user';

/**
 * Photo-search limits and results, stored in look_searches (migration 0009).
 * Server-only: uses the service role, which is the only role that can touch
 * that table or call claim_look_search.
 */

/** Who is searching: the account when signed in, otherwise a hash of the IP. */
function clientKey(request: NextRequest, profile: Profile | null): string {
  if (profile) return `user:${profile.id}`;
  // request.ip is set by the platform (Vercel) and can't be faked by the visitor.
  // Headers like X-Forwarded-For can be, so they're never used: without a real
  // IP (e.g. local dev) every visitor shares one bucket — stricter, never looser.
  const ip = request.ip ?? 'unknown';
  return `ip:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
}

/**
 * Reserve one photo search before calling the AI, or throw 429.
 * The database checks (5 a minute, the daily per-client limit, the shared
 * daily ceiling) and records it in one locked step, so parallel requests
 * can't exceed a limit and failed calls still count.
 */
export async function claimLookSearch(request: NextRequest, profile: Profile | null): Promise<string> {
  const isAdmin = profile?.role === 'admin';
  const { data, error } = await createAdminClient().rpc('claim_look_search', {
    p_client_key: clientKey(request, profile),
    p_user_id: profile?.id ?? null,
    p_is_admin: isAdmin,
    p_client_limit: profile ? lookSearch.limits.perUser : lookSearch.limits.perVisitor,
    p_global_limit: lookSearch.limits.allNonAdmin,
  });
  if (error) throw error;
  const row = (data as { id: string | null; limit_hit: string | null }[])[0];
  if (row?.id) return row.id;
  throw new AppError(
    row?.limit_hit === 'burst'
      ? 'Too many photo searches in a row. Please wait a minute.'
      : row?.limit_hit === 'global'
      ? 'Photo search has reached its daily limit. Please try again tomorrow.'
      : profile
        ? `You've used your ${lookSearch.limits.perUser} photo searches for today. Please try again tomorrow.`
        : `You've used your ${lookSearch.limits.perVisitor} photo searches for today. Sign in for more, or try again tomorrow.`,
    429,
    'LOOK_LIMIT',
  );
}

/** Keep what the AI returned, so the results page never has to call it again. */
export async function saveLookResult(id: string, result: { look: string[]; description: string; embedding?: number[] }) {
  const { error } = await createAdminClient()
    .from('look_searches')
    .update({
      look: result.look,
      description: result.description,
      embedding: result.embedding ? JSON.stringify(result.embedding) : null,
    })
    .eq('id', id);
  if (error) console.error('saveLookResult failed:', error.message); // search still works on tags alone
}

/**
 * What was saved for a photo search (?lookId= in the URL): the AI's
 * description, shown above the results, and its embedding for ranking.
 * Read from the database rather than the URL, so a hand-made link can
 * neither show made-up text nor trigger an AI call.
 */
export async function storedLook(id: string): Promise<{ description?: string; embedding?: number[] }> {
  const { data } = await createAdminClient().from('look_searches').select('description, embedding').eq('id', id).maybeSingle();
  return {
    description: data?.description ?? undefined,
    embedding: typeof data?.embedding === 'string' ? JSON.parse(data.embedding) : undefined,
  };
}

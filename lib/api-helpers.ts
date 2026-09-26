import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { roleCan, rolePermissions } from '@/lib/config/roles.config';
import type { Profile } from '@/types/user';

/** Uniform error envelope for every API route. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.flatten() } },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error('[api] unhandled error', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
    { status: 500 },
  );
}

/** Resolve the signed-in user's profile, or null for anonymous requests. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .single();
  return (data as Profile) ?? null;
}

/** Guard an API handler behind a permission from roles.config. */
export async function requirePermission(permission: keyof typeof rolePermissions): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new UnauthorizedError();
  if (!roleCan(profile.role, permission)) throw new ForbiddenError();
  return profile;
}

/**
 * Verify the shared secret on automation (n8n) endpoints. Constant-time, so
 * response timing can't reveal how much of a guess was right. With no secret
 * configured, every request is refused.
 */
export function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET;
  const given = request.headers.get('x-webhook-secret');
  if (!expected || !given) return false;
  const [a, b] = [Buffer.from(given), Buffer.from(expected)];
  return a.length === b.length && timingSafeEqual(a, b);
}

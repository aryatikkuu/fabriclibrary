import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { roleCan, rolePermissions } from '@/lib/config/roles.config';
import type { Profile } from '@/types/user';

// Simple in-memory rate limiting (10 requests per minute per IP)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0].trim() || 'unknown';
  return ip;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }

  if (record.count >= 10) {
    return false; // Rate limited
  }

  record.count++;
  return true;
}

/** Guard an API route behind rate limiting. Returns 429 if exceeded. */
export function requireRateLimit(request: NextRequest): void {
  const key = getRateLimitKey(request);
  if (!checkRateLimit(key)) {
    throw new AppError('Too many requests. Please try again in a minute.', 429);
  }
}

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

/** Verify the shared secret on automation (n8n) endpoints. */
export function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET;
  if (!expected) return false;
  return request.headers.get('x-webhook-secret') === expected;
}

/** Log a staff action for audit trail (non-blocking). */
export async function logAuditAction(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  beforeData?: unknown,
  afterData?: unknown,
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_data: beforeData ? JSON.stringify(beforeData) : null,
      after_data: afterData ? JSON.stringify(afterData) : null,
    });
  } catch (error) {
    // Silently fail — audit logging should never break the main operation
    console.error('[audit] failed to log action:', error);
  }
}

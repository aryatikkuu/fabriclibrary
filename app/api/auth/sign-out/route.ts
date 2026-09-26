import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/sign-out — ends the session and returns to the home page.
 * POST only: a GET link could be prefetched by Next.js and sign people out
 * just by appearing on screen.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 turns the form POST into a normal GET of the home page.
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}

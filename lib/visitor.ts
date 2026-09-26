import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Anonymous visitor ids — used for photo-search limits, the lead limit and
 * daily view counts. IPs are only ever stored hashed.
 */

const hash = (ip: string) => createHash('sha256').update(ip).digest('hex').slice(0, 32);

/**
 * For API routes. request.ip is set by the platform (Vercel) and can't be
 * faked; headers like X-Forwarded-For can, so they're never used here. With
 * no real IP (local dev) every visitor shares one id — stricter, never looser.
 */
export function requestVisitor(request: NextRequest): string {
  return `ip:${hash(request.ip ?? 'unknown')}`;
}

/**
 * For server components, which have headers but no request.ip. On Vercel
 * x-real-ip is set by the platform. Only used to de-duplicate page views,
 * never for limits.
 */
export function headersVisitor(headers: Headers): string {
  const ip = headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  return `ip:${hash(ip)}`;
}

/** Crawlers and link previews (WhatsApp, Slack…) — not people. */
export function isBot(userAgent: string | null): boolean {
  return !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|slack|telegram|curl|wget|headless|lighthouse/i.test(userAgent);
}

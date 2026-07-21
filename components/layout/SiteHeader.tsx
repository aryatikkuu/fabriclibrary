import Link from 'next/link';
import { appConfig } from '@/lib/config/app.config';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';

const NAV = [
  { href: '/fabrics', label: 'Fabrics' },
  { href: '/search', label: 'Search' },
  { href: '/assistant', label: 'Assistant' },
] as const;

/** Archive masthead: wordmark, tracked-mono nav, selvedge hover marks. */
export async function SiteHeader() {
  const profile = await getCurrentProfile();
  const canReview = roleCan(profile?.role, 'review.read');

  return (
    <header className="sticky top-0 z-40 border-b border-seam bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-site items-center justify-between px-6 md:px-12">
        <Link href="/" className="group flex items-baseline gap-3">
          <span aria-hidden className="h-[1.1em] w-0.5 self-center bg-thread" />
          <span className="font-display text-xl tracking-display text-ink">{appConfig.name}</span>
        </Link>

        <nav className="flex items-center gap-7 font-mono text-[10.5px] uppercase tracking-label text-graphite">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b border-transparent pb-0.5 transition-colors hover:border-thread hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          {canReview && (
            <Link
              href="/review"
              className="border-b border-transparent pb-0.5 text-review transition-colors hover:border-thread hover:text-ink"
            >
              Review
            </Link>
          )}
          {!profile && (
            <Link
              href="/login"
              className="border-b border-transparent pb-0.5 transition-colors hover:border-thread hover:text-ink"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

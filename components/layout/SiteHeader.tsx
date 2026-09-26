import Link from 'next/link';
import { appConfig } from '@/lib/config/app.config';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { primaryNav, signInNav, signOutNav, type NavItem } from '@/lib/config/nav.config';
import { NavLink } from './NavLink';
import { MobileNav } from './MobileNav';

/**
 * Archive masthead: wordmark, tracked-mono nav, selvedge hover marks.
 *
 * The visible link list is resolved here, on the server, from the role map —
 * the mobile drawer receives the finished list, never the profile itself.
 * Below `md` the inline nav is replaced by MobileNav; from `md` up the bar is
 * unchanged.
 */
export async function SiteHeader() {
  const profile = await getCurrentProfile();

  const items: NavItem[] = [
    ...primaryNav.filter((item) => !item.permission || roleCan(profile?.role, item.permission)),
    profile ? signOutNav : signInNav,
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-seam bg-paper-veil backdrop-blur">
      <div className="mx-auto flex h-[var(--header-h)] w-full max-w-site items-center justify-between gap-4 px-6 md:px-12">
        <Link href="/" className="group flex min-w-0 items-baseline gap-3">
          <span aria-hidden className="h-[1.1em] w-0.5 shrink-0 self-center bg-thread" />
          <span className="truncate font-display text-lg tracking-display text-ink md:text-xl">
            {appConfig.name}
          </span>
        </Link>

        {/* Desktop: inline bar. Hidden below md, where MobileNav takes over. */}
        <nav className="hidden items-center gap-7 font-mono text-[10.5px] uppercase tracking-label text-graphite md:flex">
          {items.map((item) => (
            <NavLink key={item.href} item={item} variant="bar" />
          ))}
        </nav>

        <MobileNav items={items} />
      </div>
    </header>
  );
}

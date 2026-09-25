'use client';

import { useEffect, useState } from 'react';
import type { NavItem } from '@/lib/config/nav.config';
import { NavLink } from './NavLink';

/**
 * Mobile masthead menu (hidden from `md` up, where the inline bar takes over).
 *
 * Receives the already-resolved link list from the server component — role
 * checks stay on the server, so no profile or permission data crosses to the
 * client. This component only knows hrefs and labels.
 */
export function MobileNav({ items }: { items: readonly NavItem[] }) {
  const [open, setOpen] = useState(false);

  // Close on Escape, and never leave the page scroll-locked behind a closed menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        className="tap-target -mr-2 flex items-center justify-center px-2 text-ink"
      >
        {/* Two rules that cross into an X — the selvedge motif, not a generic burger. */}
        <span aria-hidden className="relative block h-3 w-5">
          <span
            className={`absolute left-0 block h-px w-5 bg-ink transition-transform duration-300 ${
              open ? 'top-1.5 rotate-45' : 'top-0'
            }`}
          />
          <span
            className={`absolute left-0 block h-px w-5 bg-ink transition-transform duration-300 ${
              open ? 'top-1.5 -rotate-45' : 'top-3'
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-[var(--header-h)] z-40 border-t border-seam bg-paper shadow-[0_12px_24px_-12px_rgba(0,0,0,0.25)]"
        >
          <nav className="flex flex-col px-6 pb-8 font-mono text-[11px] uppercase tracking-label">
            {items.map((item) => (
              <NavLink key={item.href} item={item} variant="drawer" onNavigate={() => setOpen(false)} />
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

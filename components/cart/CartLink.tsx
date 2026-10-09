'use client';

import Link from 'next/link';
import { useCart } from '@/features/cart/cart';

/** Masthead link to /cart with the fabric count, which pops when something is added. */
export function CartLink() {
  const { items, addedAt } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${items.length} ${items.length === 1 ? 'fabric' : 'fabrics'}`}
      className="tap-target flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-label text-graphite transition-colors hover:text-ink"
    >
      Cart
      {/* Re-keyed on every add, so the animation replays. */}
      <span
        key={addedAt}
        className={`inline-flex h-5 min-w-5 items-center justify-center px-1 tracking-normal ${
          items.length ? 'bg-thread text-paper' : 'border border-seam text-stone'
        } ${addedAt ? 'animate-pop' : ''}`}
      >
        {items.length}
      </span>
    </Link>
  );
}

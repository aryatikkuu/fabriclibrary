'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { appConfig } from '@/lib/config/app.config';
import { useCart } from '@/features/cart/cart';
import { EmptyState } from '@/components/ui/EmptyState';
import { Arrow } from '@/components/ui/Arrow';
import { CartRequest } from './CartRequest';

/**
 * The /cart page body: the chosen fabrics (remove any, or go and add more),
 * then one swatch / price request for all of them. Once the email draft
 * opens, the cart empties.
 */
export function CartView() {
  const cart = useCart();
  const [sent, setSent] = useState<string | null>(null);
  const [firstEmail] = appConfig.contact.emails;

  if (sent) {
    return (
      <div className="mt-12 max-w-xl text-sm leading-relaxed text-graphite">
        <p className="font-display text-2xl text-ink">Your email is ready — just press send.</p>
        <p className="mt-3">
          Nothing opened? <a href={sent} className="text-ink underline underline-offset-4">Open the email again</a>, or
          write to <a href={`mailto:${firstEmail}`} className="text-ink underline underline-offset-4">{firstEmail}</a>.
        </p>
        <Link href="/fabrics" className="btn-technical mt-8">Keep browsing <Arrow /></Link>
      </div>
    );
  }

  if (!cart.loaded) return null; // the cart lives in this browser; nothing to show until it's read
  if (!cart.items.length) {
    return (
      <div className="mt-12">
        <EmptyState title="Your cart is empty" hint="Add fabrics from their pages, then request swatches or prices for all of them at once." />
        <div className="mt-8 text-center">
          <Link href="/fabrics" className="btn-technical">Browse fabrics <Arrow /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 grid gap-12 md:grid-cols-[55fr_45fr] md:gap-16">
      <div>
        <ul className="border-t border-seam">
          {cart.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 border-b border-seam py-4">
              <Link href={`/fabrics/${item.id}`} className="relative h-20 w-16 shrink-0 overflow-hidden bg-linen">
                {item.image && <Image src={item.image} alt={item.name ?? item.code ?? 'Fabric'} fill sizes="64px" className="object-cover" />}
              </Link>
              <Link href={`/fabrics/${item.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate font-mono text-xs uppercase tracking-label text-stone">{item.code ?? 'No code'}</span>
                <span className="mt-1 block truncate font-display text-lg text-ink">{item.name?.trim() || 'Unnamed quality'}</span>
                {item.mill && <span className="t-label mt-1 block">{item.mill}</span>}
              </Link>
              <button type="button" onClick={() => cart.remove(item.id)} className="t-label shrink-0 hover:text-thread">
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/fabrics" className="btn-technical">+ Add more fabrics</Link>
          <span className="t-label">
            {cart.items.length} of {appConfig.leads.maxCart}
          </span>
        </div>
      </div>

      <div>
        <h2 className="border-b border-ink pb-2 font-display text-lg text-ink">Request swatches / price</h2>
        <div className="mt-6">
          <CartRequest
            items={cart.items}
            onSent={(mailto) => {
              setSent(mailto);
              cart.clear();
            }}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { appConfig } from '@/lib/config/app.config';
import { useCart, type CartItem } from '@/features/cart/cart';
import { Arrow } from '@/components/ui/Arrow';

/** "Add to cart" on a fabric page; once added, a link to the cart and an undo. */
export function AddToCart({ fabric }: { fabric: CartItem }) {
  const cart = useCart();

  if (cart.has(fabric.id)) {
    return (
      <div className="mt-8 flex gap-3">
        <Link href="/cart" className="btn-technical flex-1 justify-center py-3.5">
          <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 12l5 5L20 6" strokeDasharray="24" className="animate-draw" />
          </svg>
          In your cart · View cart <Arrow />
        </Link>
        <button type="button" onClick={() => cart.remove(fabric.id)} className="btn-technical">
          Remove
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => cart.add(fabric)}
      disabled={cart.full}
      className="btn-technical mt-8 w-full justify-center bg-ink py-3.5 text-paper hover:bg-paper hover:text-ink disabled:opacity-50"
    >
      {cart.full ? `Cart is full (${appConfig.leads.maxCart} fabrics)` : 'Add to cart'}
    </button>
  );
}

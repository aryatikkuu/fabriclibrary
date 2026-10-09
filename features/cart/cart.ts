'use client';

import { useSyncExternalStore } from 'react';
import { appConfig } from '@/lib/config/app.config';

/**
 * The visitor's cart: fabrics they want swatches or prices for, sent as one
 * request from /cart. Kept in this browser's localStorage (no account
 * needed) and shared by every component through useCart(). Other open tabs
 * follow along via the storage event.
 */

/** What the cart page shows for a fabric, saved when it's added. */
export interface CartItem {
  id: string;
  code: string | null;
  name: string | null;
  mill: string | null;
  image: string | null;
}

interface CartState {
  items: CartItem[];
  /** False until localStorage has been read (always false on the server). */
  loaded: boolean;
  /** When something was last added in this tab, so the header count can animate. */
  addedAt: number;
}

const KEY = 'tms-cart';
const SERVER_STATE: CartState = { items: [], loaded: false, addedAt: 0 };
const listeners = new Set<() => void>();
let state: CartState | null = null;

function readStorage(): CartItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return []; // storage blocked or corrupt: start empty
  }
}

function snapshot(): CartState {
  return (state ??= { items: readStorage(), loaded: true, addedAt: 0 });
}

function update(items: CartItem[], addedAt = snapshot().addedAt) {
  state = { items, loaded: true, addedAt };
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Private mode etc.: the cart still works until the page closes.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    state = { ...snapshot(), items: readStorage() };
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useCart() {
  const { items, loaded, addedAt } = useSyncExternalStore(subscribe, snapshot, () => SERVER_STATE);
  const has = (id: string) => items.some((item) => item.id === id);
  return {
    items,
    loaded,
    addedAt,
    has,
    full: items.length >= appConfig.leads.maxCart,
    add(item: CartItem) {
      if (!has(item.id) && items.length < appConfig.leads.maxCart) update([...items, item], Date.now());
    },
    remove(id: string) {
      update(items.filter((item) => item.id !== id));
    },
    clear() {
      update([]);
    },
  };
}

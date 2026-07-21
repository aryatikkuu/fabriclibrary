'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Statement search: a full-width technical frame with crosshair corners,
 * serif input at display scale, mono action.
 */
export function FabricSearchBar({
  placeholder = 'Search by code, name, composition, colour…',
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set('q', value.trim());
    else params.delete('q');
    params.delete('page');
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="relative">
      {/* crosshair corner marks */}
      {['-left-1 -top-3', '-right-1 -top-3', '-bottom-3 -left-1', '-bottom-3 -right-1'].map((pos) => (
        <span key={pos} aria-hidden className={`absolute select-none font-mono text-xs text-stone ${pos}`}>
          +
        </span>
      ))}
      <form onSubmit={submit} className="flex items-stretch border border-ink bg-paper">
        <span aria-hidden className="flex items-center pl-5 text-stone">
          {/* flat magnifier */}
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M13 13 L18 18" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Search fabrics"
          className="w-full bg-transparent px-4 py-5 font-display text-xl text-ink placeholder:text-stone focus:outline-none md:text-2xl"
        />
        <button
          type="submit"
          className="border-l border-ink px-7 font-mono text-[10.5px] uppercase tracking-label text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Search
        </button>
      </form>
    </div>
  );
}

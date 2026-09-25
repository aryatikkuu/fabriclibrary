'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { LookSearchPanel } from './LookSearchPanel';

/**
 * Statement search: a full-width technical frame with crosshair corners,
 * serif input at display scale, mono action. With `photoSearch` (signed-in
 * users), a camera button opens search-by-photo.
 */
export function FabricSearchBar({
  placeholder = 'Search by code, name, composition, colour…',
  photoSearch = false,
}: {
  placeholder?: string;
  photoSearch?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const [photoOpen, setPhotoOpen] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set('q', value.trim());
    else params.delete('q');
    params.delete('look'); // a text search replaces any photo search
    params.delete('lookNote');
    params.delete('page');
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div>
      <div className="relative">
        {/* crosshair corner marks — on the bar itself, so the photo drawer below doesn't move them */}
        {['-left-1 -top-3', '-right-1 -top-3', '-bottom-3 -left-1', '-bottom-3 -right-1'].map((pos) => (
          <span key={pos} aria-hidden className={`absolute select-none font-mono text-xs text-stone ${pos} ${photoOpen && pos.includes('bottom') ? 'hidden' : ''}`}>
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
          {photoSearch && (
            <button
              type="button"
              onClick={() => setPhotoOpen((open) => !open)}
              aria-label="Search by photo"
              aria-expanded={photoOpen}
              title="Search by photo"
              className={`flex items-center border-l border-ink px-5 transition-colors hover:bg-ink hover:text-paper ${
                photoOpen ? 'bg-ink text-paper' : 'text-ink'
              }`}
            >
              {/* flat camera */}
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 6.5 H6 L7.5 4.5 H12.5 L14 6.5 H17.5 V15.5 H2.5 Z" strokeLinejoin="round" />
                <circle cx="10" cy="10.75" r="3" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            className="border-l border-ink px-7 font-mono text-[10.5px] uppercase tracking-label text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Search
          </button>
        </form>
      </div>
      {photoOpen && <LookSearchPanel onClose={() => setPhotoOpen(false)} />}
    </div>
  );
}

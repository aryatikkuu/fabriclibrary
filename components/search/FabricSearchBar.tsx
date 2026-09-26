'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LookSearchPanel } from './LookSearchPanel';

/**
 * Statement search: a full-width technical frame with crosshair corners,
 * serif input at display scale, mono action. With `photoSearch` (signed-in
 * users), a camera button on the frame's edge swaps the text search for
 * search-by-photo in the same frame, and back.
 */
export function FabricSearchBar({
  placeholder = 'Search by code, name, composition, colour…',
  shortPlaceholder = 'Code, name, colour…',
  photoSearch = false,
}: {
  placeholder?: string;
  /** Shown on phones, where the full placeholder would be cut off. */
  shortPlaceholder?: string;
  photoSearch?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const [photoOpen, setPhotoOpen] = useState(false);
  const textInput = useRef<HTMLInputElement>(null);
  const narrow = useNarrowScreen();

  const wasPhotoOpen = useRef(false);

  // Back from photo to text search: put the cursor in the box once it is visible again.
  useEffect(() => {
    if (wasPhotoOpen.current && !photoOpen) textInput.current?.focus();
    wasPhotoOpen.current = photoOpen;
  }, [photoOpen]);

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
    // data-photo-open lets the page move the filters beside photo search, in CSS only.
    // flex-1 / h-full: beside the filters (see app/search/page.tsx) the frame grows to their height.
    <div data-photo-open={photoOpen || undefined} className="relative flex flex-1 flex-col">
      {/* crosshair corner marks */}
      {['-left-1 -top-3', '-right-1 -top-3', '-bottom-3 -left-1', '-bottom-3 -right-1'].map((pos) => (
        <span key={pos} aria-hidden className={`absolute select-none font-mono text-xs text-stone ${pos}`}>
          +
        </span>
      ))}
      <div className="flex flex-1 items-stretch border border-ink bg-paper">
        {/* Text search and photo search share the frame; the camera slides one out and the other in. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <Reveal show={!photoOpen}>
            <form onSubmit={submit} className="flex items-stretch">
              <span aria-hidden className="hidden items-center pl-5 text-stone sm:flex">
                {/* flat magnifier */}
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M13 13 L18 18" strokeLinecap="round" />
                </svg>
              </span>
              <input
                ref={textInput}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={narrow ? shortPlaceholder : placeholder}
                aria-label="Search fabrics"
                enterKeyHint="search"
                className="w-full min-w-0 bg-transparent px-3 py-5 font-display text-lg text-ink placeholder:text-stone focus:outline-none sm:px-4 sm:text-xl md:text-2xl"
              />
              <button
                type="submit"
                className="border-l border-ink px-4 font-mono text-[10.5px] uppercase tracking-label text-ink transition-colors hover:bg-ink hover:text-paper sm:px-7"
              >
                Search
              </button>
            </form>
          </Reveal>
          {photoSearch && (
            <Reveal show={photoOpen}>
              <LookSearchPanel active={photoOpen} onClose={() => setPhotoOpen(false)} />
            </Reveal>
          )}
        </div>
        {photoSearch && (
          <button
            type="button"
            onClick={() => setPhotoOpen(!photoOpen)}
            aria-label={photoOpen ? 'Search by text instead' : 'Search by photo'}
            aria-pressed={photoOpen}
            title={photoOpen ? 'Search by text instead' : 'Search by photo'}
            className={`flex items-center border-l border-ink px-4 transition-colors sm:px-5 hover:bg-ink hover:text-paper ${
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
      </div>
    </div>
  );
}

/** True below Tailwind's `sm` breakpoint (640 px). False during server render. */
function useNarrowScreen() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

/**
 * Animates its content open and shut (height + fade) by transitioning the grid
 * row from 0fr to 1fr. When shut it is also invisible, so nothing inside can
 * be tabbed to; the visibility change waits for the fade to finish.
 */
function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
        show ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

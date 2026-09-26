'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { formatLook, lookLabel, parseLook } from '@/features/look-search/look-tags';

/**
 * What the AI saw in the buyer's photo, as removable chips. Removing one only
 * changes the URL, so the library is re-ranked with no new AI call. It also
 * drops the stored search (lookId): its description still describes the whole
 * photo (e.g. "navy …" after navy was removed), so from then on the search
 * ranks by tags alone. `note` is that description, read on the server.
 */
export function LookChips({ note }: { note?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const look = parseLook(searchParams.get('look'));
  if (look.length === 0) return null;

  function update(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length) params.set('look', formatLook(next));
    else params.delete('look');
    params.delete('lookId');
    params.delete('page');
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="mt-6 border-l-2 border-thread pl-4">
      <span className="field-label">Matching by look</span>
      {note && <p className="mt-1 font-display text-lg text-ink">{note}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {look.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => update(look.filter((t) => t !== tag))}
            title="Remove from search"
            className="group flex items-center gap-1.5 border border-seam px-2.5 py-1 font-mono text-[11px] text-ink transition-colors hover:border-ink"
          >
            {lookLabel(tag)}
            <span aria-hidden className="text-stone group-hover:text-ink">×</span>
            <span className="sr-only">remove</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => update([])}
          className="ml-2 font-mono text-[10.5px] uppercase tracking-label text-stone underline-offset-4 hover:text-ink hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

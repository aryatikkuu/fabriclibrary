'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatLook } from '@/features/look-search/look-tags';

/** Longest side sent to the AI. Plenty for pattern and colour; keeps uploads ~200 KB. */
const MAX_SIDE = 1024;

/** Shrink in the browser so the upload (and the AI's image tokens) stay small. */
async function shrink(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo'))), 'image/jpeg', 0.85),
  );
}

/**
 * Photo search: drop / paste / pick a photo and optionally say what it's for.
 * One API call turns that into tags; the tags go into the URL (?look=…) and
 * the server page ranks the library from there, keeping any active filters.
 */
export function LookSearchPanel({ active, onClose }: { active: boolean; onClose: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function choose(file: File | null | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    setError(null);
    setPhoto(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }

  // Paste a photo from the clipboard while photo search is showing.
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => choose(e.clipboardData?.files?.[0]);
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [active]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!photo && !note.trim()) return setError('Add a photo or describe what you need.');
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      if (photo) form.set('image', await shrink(photo), 'photo.jpg');
      form.set('note', note.trim());
      const res = await fetch('/api/search/look', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Search failed');
      if (!body.look?.length) throw new Error('Could not recognise a fabric — try a closer photo.');

      const params = new URLSearchParams(searchParams.toString());
      params.set('look', formatLook(body.look));
      if (body.lookId) params.set('lookId', body.lookId);
      else params.delete('lookId');
      params.delete('q');
      params.delete('page');
      router.push(`/search?${params.toString()}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    // Sits inside the search bar's frame (FabricSearchBar), in place of the text search.
    <form
      onSubmit={submit}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); }}
      className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5"
    >
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        aria-label={preview ? 'Change photo' : 'Choose a photo'}
        className={`group relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden border transition-colors sm:h-36 sm:w-36 ${
          dragging ? 'border-ink bg-linen' : preview ? 'border-seam hover:border-ink' : 'border-dashed border-seam hover:border-ink'
        }`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimisable */}
            <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center font-mono text-[9.5px] uppercase tracking-label text-paper opacity-0 transition-opacity group-hover:opacity-100">
              Change
            </span>
          </>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-label text-stone group-hover:text-ink">
            {dragging ? 'Drop it' : '+ Add photo'}
          </span>
        )}
      </button>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <p className="text-sm leading-snug text-graphite">
          Drop, paste or choose a close-up of the cloth to find fabrics that look like it.
        </p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          aria-label="What is it for? (optional)"
          placeholder="What is it for? (optional)"
          className="w-full border border-seam bg-paper px-3 py-2 text-base text-ink placeholder:text-stone focus:border-ink focus:outline-none sm:text-sm"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-ink px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-label text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {busy ? 'Reading photo…' : 'Find similar'}
          </button>
          {error && <span role="alert" className="basis-full text-sm text-thread">{error}</span>}
        </div>
      </div>
    </form>
  );
}

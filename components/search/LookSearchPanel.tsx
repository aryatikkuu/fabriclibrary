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
export function LookSearchPanel({ onClose }: { onClose: () => void }) {
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

  // Paste a photo from the clipboard while the panel is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => choose(e.clipboardData?.files?.[0]);
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
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
      if (body.description) params.set('lookNote', body.description);
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
    <form onSubmit={submit} className="mt-4 border border-ink bg-paper p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-label text-ink">Search by photo</span>
        <button type="button" onClick={onClose} className="font-mono text-[10.5px] uppercase tracking-label text-stone hover:text-ink">
          Close
        </button>
      </div>

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); }}
        className={`mt-4 flex min-h-40 w-full items-center justify-center border border-dashed p-4 transition-colors ${
          dragging ? 'border-ink bg-linen' : 'border-seam hover:border-ink'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimisable
          <img src={preview} alt="Your photo" className="max-h-56 object-contain" />
        ) : (
          <span className="text-center text-sm text-graphite">
            Drop a photo here, paste one, or <span className="underline underline-offset-4">choose a file</span>
            <span className="mt-1 block font-mono text-[10.5px] text-stone">A close-up of the cloth works best</span>
          </span>
        )}
      </button>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />

      <label className="mt-4 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-label text-stone">What is it for? (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="e.g. summer shirts, lightweight dresses, upholstery"
          className="border border-seam bg-paper px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-ink focus:outline-none"
        />
      </label>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="border border-ink px-6 py-2.5 font-mono text-[10.5px] uppercase tracking-label text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {busy ? 'Reading photo…' : 'Find similar'}
        </button>
        {error && <span role="alert" className="text-sm text-thread">{error}</span>}
      </div>
    </form>
  );
}

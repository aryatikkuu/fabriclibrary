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
 * Photo search behaviour shared by every photo-search layout (the search
 * bar's panel, the homepage card): pick / drop / paste a photo, an optional
 * note, and submit — one API call turns them into tags, which go into the URL
 * (?look=…&lookId=…) so the search page ranks the library from there.
 *
 * `pasteActive`: listen for pasted photos only while the layout is showing.
 */
export function useLookSearch({ pasteActive = true, onDone }: { pasteActive?: boolean; onDone?: () => void } = {}) {
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

  useEffect(() => {
    if (!pasteActive) return;
    const onPaste = (e: ClipboardEvent) => choose(e.clipboardData?.files?.[0]);
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [pasteActive]);
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
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  /** Spread onto the form: dropping a photo anywhere on it picks it. */
  const dropZone = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); },
  };

  /** The hidden file input the "choose a photo" control opens. */
  const fileInputProps = {
    ref: fileInput, type: 'file', accept: 'image/*', hidden: true,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => choose(e.target.files?.[0]),
  } as const;

  return {
    preview, note, setNote, busy, error, dragging, submit, dropZone, fileInputProps,
    openPicker: () => fileInput.current?.click(),
  };
}

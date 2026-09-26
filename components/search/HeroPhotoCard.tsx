'use client';

import { useLookSearch } from './useLookSearch';

/**
 * Homepage hero photo search: a square drop area (the photo fills it once
 * chosen), an optional note and Find similar. Behaviour lives in useLookSearch.
 */
export function HeroPhotoCard() {
  const { preview, note, setNote, busy, error, dragging, submit, dropZone, fileInputProps, openPicker } = useLookSearch();

  return (
    <form onSubmit={submit} {...dropZone} className="w-full border border-ink bg-paper p-4 sm:p-5">
      <button
        type="button"
        onClick={openPicker}
        aria-label={preview ? 'Change photo' : 'Choose a photo'}
        className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden border px-6 text-center transition-colors ${
          dragging ? 'border-ink bg-linen' : preview ? 'border-seam' : 'border-dashed border-stone hover:border-ink hover:bg-linen'
        }`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimisable */}
            <img src={preview} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-2 font-mono text-[10px] uppercase tracking-label text-paper opacity-0 transition-opacity group-hover:opacity-100">
              Change photo
            </span>
          </>
        ) : (
          <>
            <svg aria-hidden viewBox="0 0 20 20" className="h-8 w-8 text-graphite group-hover:text-ink" fill="none" stroke="currentColor" strokeWidth="1.25">
              <path d="M2.5 6.5 H6 L7.5 4.5 H12.5 L14 6.5 H17.5 V15.5 H2.5 Z" strokeLinejoin="round" />
              <circle cx="10" cy="10.75" r="3" />
            </svg>
            <span className="font-display text-xl text-ink">{dragging ? 'Drop it here' : 'Drop or choose a photo'}</span>
            <span className="text-sm text-stone">or paste one · a close-up of the cloth works best</span>
          </>
        )}
      </button>
      <input {...fileInputProps} />

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        aria-label="What is it for? (optional)"
        placeholder="What is it for? (optional)"
        className="field mt-4 h-10 px-3"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full bg-ink py-3 font-mono text-[10.5px] uppercase tracking-label text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {busy ? 'Reading photo…' : 'Find similar'}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-thread">{error}</p>}
    </form>
  );
}

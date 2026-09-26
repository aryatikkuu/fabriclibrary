'use client';

import { useLookSearch } from './useLookSearch';

/**
 * Photo search inside the search bar's frame (FabricSearchBar): a small photo
 * tile beside the note and Find similar. Behaviour lives in useLookSearch.
 */
export function LookSearchPanel({ active, onClose }: { active: boolean; onClose: () => void }) {
  const { preview, note, setNote, busy, error, dragging, submit, dropZone, fileInputProps, openPicker } =
    useLookSearch({ pasteActive: active, onDone: onClose });

  return (
    // Sits inside the search bar's frame (FabricSearchBar), in place of the text search.
    <form
      onSubmit={submit}
      {...dropZone}
      className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5"
    >
      <button
        type="button"
        onClick={openPicker}
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
      <input {...fileInputProps} />

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
          className="field h-10 px-3"
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

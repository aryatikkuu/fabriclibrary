import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

/** Flat-vector hanger — the archive's mark for "nothing on this rail yet". */
function HangerIcon() {
  return (
    <svg
      viewBox="0 0 64 40"
      className="mx-auto h-10 w-16 text-stone"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      {/* hook */}
      <path d="M32 12 V8 a4 4 0 1 1 4 -4" strokeLinecap="round" />
      {/* shoulders */}
      <path d="M32 12 L6 30 H58 L32 12 Z" strokeLinejoin="round" />
    </svg>
  );
}

/** Empty rail: stitch-dashed frame, hanger mark, quiet direction. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="stitch px-10 py-20 text-center">
      <HangerIcon />
      <p className="mt-6 font-display text-2xl text-ink">{title}</p>
      {hint && <TechnicalLabel className="mx-auto mt-4 max-w-md normal-case tracking-wide">{hint}</TechnicalLabel>}
    </div>
  );
}

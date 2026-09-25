/**
 * Inline arrow for link labels ("View all →"). Drawn as SVG rather than the
 * → / ← characters: the site fonts load the Latin subset only, so browsers
 * substitute the arrow from a fallback font — Firefox on macOS renders it as
 * a white arrow in a black box. Inherits the text colour and scales with it.
 */
export function Arrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 10"
      className={`inline-block h-[0.7em] w-[1.1em] align-[0.05em] ${direction === 'left' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <path d="M0 5h15M11 1l4 4-4 4" />
    </svg>
  );
}

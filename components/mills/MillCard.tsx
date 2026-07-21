import Link from 'next/link';
import type { MillWithCount } from '@/services/mill.service';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

/** Mill index card — a labelled drawer in the archive. */
export function MillCard({ mill }: { mill: MillWithCount }) {
  return (
    <Link
      href={`/mills/${mill.slug}`}
      className="group relative flex flex-col justify-between border border-seam bg-paper p-9 transition-colors hover:border-ink"
    >
      {/* selvedge thread on hover */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-0 w-0.5 bg-thread transition-all duration-500 group-hover:h-full"
      />
      <div>
        <TechnicalLabel>{mill.country ?? 'Mill'}</TechnicalLabel>
        <h3 className="mt-4 font-display text-2xl leading-tight tracking-display text-ink">{mill.name}</h3>
        {mill.description && (
          <p className="mt-3 text-sm leading-relaxed text-graphite">{mill.description}</p>
        )}
      </div>
      <p className="t-label mt-10 group-hover:text-ink">
        {mill.fabricCount} {mill.fabricCount === 1 ? 'fabric' : 'fabrics'} →
      </p>
    </Link>
  );
}

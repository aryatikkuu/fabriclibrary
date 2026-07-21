import type { MillWithCount } from '@/services/mill.service';
import { MillCard } from './MillCard';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

export function MillSection({ mills }: { mills: MillWithCount[] }) {
  return (
    <section className="mt-24">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
        <h2 className="font-display text-3xl tracking-display text-ink">Mills</h2>
        <TechnicalLabel>{mills.length} partners</TechnicalLabel>
      </div>
      <div className="mt-10 grid gap-7 md:grid-cols-3">
        {mills.map((mill) => (
          <MillCard key={mill.id} mill={mill} />
        ))}
      </div>
    </section>
  );
}

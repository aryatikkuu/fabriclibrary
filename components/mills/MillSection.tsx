import type { MillWithCount } from '@/services/mill.service';
import { MillCard } from './MillCard';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function MillSection({ mills }: { mills: MillWithCount[] }) {
  return (
    <section className="mt-24">
      <SectionHeading title="Mills" aside={<TechnicalLabel>{mills.length} partners</TechnicalLabel>} />
      <div className="mt-10 grid gap-7 md:grid-cols-3">
        {mills.map((mill) => (
          <MillCard key={mill.id} mill={mill} />
        ))}
      </div>
    </section>
  );
}

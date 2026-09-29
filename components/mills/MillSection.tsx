import type { MillWithCount } from '@/services/mill.service';
import { isPartnerMill } from '@/lib/config/mills.config';
import { MillCard } from './MillCard';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';
import { SectionHeading } from '@/components/ui/SectionHeading';

/**
 * Home page mill cards. Mills with nothing to show yet are left out, and
 * the Extended Range isn't counted as a partner.
 */
export function MillSection({ mills }: { mills: MillWithCount[] }) {
  const shown = mills.filter((mill) => mill.fabricCount > 0);
  const partners = shown.filter((mill) => isPartnerMill(mill.slug)).length;

  return (
    <section className="mt-24">
      <SectionHeading title="Mills" aside={<TechnicalLabel>{partners} partners</TechnicalLabel>} />
      <div className={`mt-10 grid gap-7 ${shown.length > 3 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
        {shown.map((mill) => (
          <MillCard key={mill.id} mill={mill} />
        ))}
      </div>
    </section>
  );
}

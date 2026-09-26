import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { HeroPhotoCard } from '@/components/search/HeroPhotoCard';
import { MillSection } from '@/components/mills/MillSection';
import { FabricGrid } from '@/components/fabrics/FabricGrid';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';
import { Arrow } from '@/components/ui/Arrow';
import { SectionHeading } from '@/components/ui/SectionHeading';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const services = buildServices(await createClient());
  const profile = await getCurrentProfile();
  const canReview = roleCan(profile?.role, 'review.read');

  const [mills, recent, featured, pending] = await Promise.all([
    services.millService.listWithCounts(),
    services.fabricService.search({ reviewStatus: 'approved', sort: 'newest', pageSize: 8 }),
    services.fabricService.search({ reviewStatus: 'approved', sort: 'code', pageSize: 4 }),
    canReview
      ? services.reviewService.getQueue(1, 1)
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 1 }),
  ]);

  const totalFabrics = mills.reduce((sum, mill) => sum + mill.fabricCount, 0);

  return (
    <EditorialLayout>
      {/* Hero — photo search: the words on the left, a square photo card on the right */}
      <section className="grid items-center gap-12 border-b border-seam pb-20 pt-16 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-16 md:pt-24">
        <div className="selvedge">
          <TechnicalLabel crosshair>
            Mill archive · {totalFabrics} {totalFabrics === 1 ? 'quality' : 'qualities'} indexed
          </TechnicalLabel>
          <h1 className="display-hero mt-6">Upload a photo, find your fabric.</h1>
          <p className="mt-8 max-w-md text-base leading-relaxed text-graphite">
            Photograph a hanger, a garment or a swatch — we&rsquo;ll match it against {totalFabrics} qualities
            from {mills.length} mills.
          </p>
          <Link href="/search" className="t-label mt-8 inline-flex items-center gap-2 hover:text-ink">
            Know the code? Search by code, name or colour <Arrow />
          </Link>
          {canReview && pending.total > 0 && (
            <Link href="/review" className="btn-technical btn-technical--thread mt-10 flex w-fit">
              {pending.total} {pending.total === 1 ? 'record' : 'records'} awaiting review <Arrow />
            </Link>
          )}
        </div>

        <div className="mx-auto w-full max-w-md md:mx-0 md:justify-self-end">
          <Suspense>
            <HeroPhotoCard />
          </Suspense>
        </div>
      </section>

      {/* Mills */}
      <MillSection mills={mills} />

      {/* Recently added */}
      <section className="mt-24">
        <SectionHeading
          title="Recently added"
          aside={<Link href="/fabrics" className="t-label hover:text-ink">View all <Arrow /></Link>}
        />
        <div className="mt-10">
          <FabricGrid fabrics={recent.items} emptyHint="Run the seed script or upload a hanger photo to begin." />
        </div>
      </section>

      {/* Featured */}
      {featured.items.length > 0 && (
        <section className="mt-24">
          <SectionHeading title="From the archive" aside={<TechnicalLabel>Selected qualities</TechnicalLabel>} />
          <div className="mt-10">
            <FabricGrid fabrics={featured.items} />
          </div>
        </section>
      )}
    </EditorialLayout>
  );
}

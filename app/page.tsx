import Link from 'next/link';
import { Suspense } from 'react';
import { appConfig } from '@/lib/config/app.config';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { FabricSearchBar } from '@/components/search/FabricSearchBar';
import { MillSection } from '@/components/mills/MillSection';
import { FabricGrid } from '@/components/fabrics/FabricGrid';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

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
      {/* Hero — poster-scale title against an index column */}
      <section className="grid gap-12 border-b border-seam pb-20 pt-20 md:grid-cols-[1fr_220px] md:gap-16 md:pt-28">
        <div className="selvedge">
          <TechnicalLabel crosshair>
            Mill archive · {totalFabrics} {totalFabrics === 1 ? 'quality' : 'qualities'} indexed
          </TechnicalLabel>
          <h1 className="display-hero mt-6 max-w-4xl">{appConfig.name}</h1>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-graphite">{appConfig.tagline}</p>
          <div className="mt-14 max-w-2xl">
            <Suspense>
              <FabricSearchBar />
            </Suspense>
          </div>
          {canReview && pending.total > 0 && (
            <Link href="/review" className="btn-technical btn-technical--thread mt-10">
              {pending.total} {pending.total === 1 ? 'record' : 'records'} awaiting review →
            </Link>
          )}
        </div>

        {/* Index column — vertical hairline, archive figures */}
        <aside className="hidden border-l border-seam pl-8 md:block">
          <dl className="space-y-10">
            <div>
              <dt className="t-label">Mills</dt>
              <dd className="mt-2 font-display text-4xl tracking-display text-ink">
                {String(mills.length).padStart(2, '0')}
              </dd>
            </div>
            <div>
              <dt className="t-label">Qualities</dt>
              <dd className="mt-2 font-display text-4xl tracking-display text-ink">
                {String(totalFabrics).padStart(2, '0')}
              </dd>
            </div>
            <div>
              <dt className="t-label">Index</dt>
              <dd className="mt-2 font-mono text-[10.5px] uppercase tracking-label text-stone">
                Photographed · read · searchable
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      {/* Mills */}
      <MillSection mills={mills} />

      {/* Recently added */}
      <section className="mt-24">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
          <h2 className="font-display text-3xl tracking-display text-ink">Recently added</h2>
          <Link href="/fabrics" className="t-label hover:text-ink">
            View all →
          </Link>
        </div>
        <div className="mt-10">
          <FabricGrid fabrics={recent.items} emptyHint="Run the seed script or upload a hanger photo to begin." />
        </div>
      </section>

      {/* Featured */}
      {featured.items.length > 0 && (
        <section className="mt-24">
          <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
            <h2 className="font-display text-3xl tracking-display text-ink">From the archive</h2>
            <TechnicalLabel>Selected qualities</TechnicalLabel>
          </div>
          <div className="mt-10">
            <FabricGrid fabrics={featured.items} />
          </div>
        </section>
      )}
    </EditorialLayout>
  );
}

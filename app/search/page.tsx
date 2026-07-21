import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { fabricSearchSchema } from '@/features/fabrics/types/fabric.schema';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { FabricSearchBar } from '@/components/search/FabricSearchBar';
import { FabricFilters } from '@/components/search/FabricFilters';
import { FabricGrid } from '@/components/fabrics/FabricGrid';
import { Pagination } from '@/components/ui/Pagination';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const services = buildServices(await createClient());
  const profile = await getCurrentProfile();
  const isStaff = roleCan(profile?.role, 'review.read');

  const parsed = fabricSearchSchema.parse(searchParams);
  const [fabrics, mills] = await Promise.all([
    services.fabricService.search({
      ...parsed,
      reviewStatus: parsed.reviewStatus ?? (isStaff ? undefined : 'approved'),
    }),
    services.millService.list(),
  ]);

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="Find a quality"
        title="Search the archive"
        description="By fabric code, name, fibre, weight, colour, use or mill."
      />

      <div className="mt-10 max-w-2xl">
        <Suspense>
          <FabricSearchBar />
        </Suspense>
      </div>

      <div className="mt-8">
        <Suspense>
          <FabricFilters mills={mills.map((m) => ({ name: m.name, slug: m.slug }))} />
        </Suspense>
      </div>

      <div className="mt-12 flex items-baseline justify-between border-b border-seam pb-3">
        <span className="font-mono text-[11px] uppercase tracking-label text-stone">
          {fabrics.total} {fabrics.total === 1 ? 'result' : 'results'}
          {parsed.q ? ` for “${parsed.q}”` : ''}
        </span>
      </div>

      <div className="mt-8">
        <FabricGrid
          fabrics={fabrics.items}
          showStatus={isStaff}
          emptyHint="Try a broader term — search covers codes, names, compositions and colours."
        />
      </div>

      <Suspense>
        <Pagination total={fabrics.total} page={fabrics.page} pageSize={fabrics.pageSize} />
      </Suspense>
    </EditorialLayout>
  );
}

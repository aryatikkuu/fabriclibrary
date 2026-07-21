import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { fabricSearchSchema } from '@/features/fabrics/types/fabric.schema';
import { NotFoundError } from '@/lib/errors';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { FabricGrid } from '@/components/fabrics/FabricGrid';
import { FabricFilters } from '@/components/search/FabricFilters';
import { Pagination } from '@/components/ui/Pagination';

export const dynamic = 'force-dynamic';

export default async function MillPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const services = buildServices(await createClient());

  let mill;
  try {
    mill = await services.millService.getBySlug(params.slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const parsed = fabricSearchSchema.parse(searchParams);
  const fabrics = await services.fabricService.searchByMill(params.slug, {
    ...parsed,
    reviewStatus: parsed.reviewStatus ?? 'approved',
  });

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow={mill.country ?? 'Mill'}
        title={mill.name}
        description={mill.description ?? undefined}
        aside={
          <span className="font-mono text-[11px] uppercase tracking-label text-stone">
            {fabrics.total} {fabrics.total === 1 ? 'quality' : 'qualities'}
          </span>
        }
      />

      <div className="mt-10">
        <Suspense>
          <FabricFilters mills={[]} />
        </Suspense>
      </div>

      <div className="mt-10">
        <FabricGrid
          fabrics={fabrics.items}
          emptyHint={`No fabrics from ${mill.name} match these filters yet.`}
        />
      </div>

      <Suspense>
        <Pagination total={fabrics.total} page={fabrics.page} pageSize={fabrics.pageSize} />
      </Suspense>
    </EditorialLayout>
  );
}

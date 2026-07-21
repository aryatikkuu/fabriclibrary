import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { fabricSearchSchema } from '@/features/fabrics/types/fabric.schema';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { FabricGrid } from '@/components/fabrics/FabricGrid';
import { Pagination } from '@/components/ui/Pagination';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Fabrics' };

export default async function FabricsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const services = buildServices(await createClient());
  const profile = await getCurrentProfile();
  const isStaff = roleCan(profile?.role, 'review.read');

  const parsed = fabricSearchSchema.parse(searchParams);
  const fabrics = await services.fabricService.search({
    ...parsed,
    // Staff see everything (including needs_review); visitors see approved only.
    reviewStatus: parsed.reviewStatus ?? (isStaff ? undefined : 'approved'),
    sort: parsed.sort ?? 'newest',
  });

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="The archive"
        title="All fabrics"
        description="Every quality in the library, newest first. Use search for codes, fibres and weights."
        aside={
          <span className="font-mono text-[11px] uppercase tracking-label text-stone">
            {fabrics.total} {fabrics.total === 1 ? 'quality' : 'qualities'}
          </span>
        }
      />

      <div className="mt-10">
        <FabricGrid fabrics={fabrics.items} showStatus={isStaff} />
      </div>

      <Suspense>
        <Pagination total={fabrics.total} page={fabrics.page} pageSize={fabrics.pageSize} />
      </Suspense>
    </EditorialLayout>
  );
}

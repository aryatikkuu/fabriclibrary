import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { findCollection } from '@/lib/config/collections.config';
import { parseSearchPageParams } from '@/features/fabrics/types/fabric.schema';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { FabricGrid } from '@/components/fabrics/FabricGrid';
import { Pagination } from '@/components/ui/Pagination';
import { FilterChips } from '@/components/collections/FilterChips';
import { ApproveCollection } from '@/components/collections/ApproveCollection';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { slug: string } }) {
  return { title: findCollection(params.slug)?.name ?? 'Collection' };
}

/** One swatch book: its colours, filterable by blend and colour family. */
export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const collection = findCollection(params.slug);
  if (!collection) notFound();

  const services = buildServices(await createClient());
  const profile = await getCurrentProfile();
  const isStaff = roleCan(profile?.role, 'review.read');
  const canApprove = roleCan(profile?.role, 'review.approve');

  const { fabricName, colorFamily, page } = parseSearchPageParams(searchParams);
  const [mill, summary, swatches] = await Promise.all([
    services.millService.getBySlug(collection.millSlug),
    services.fabricService.collectionSummary(collection.slug),
    services.fabricService.search({
      collection: collection.slug, fabricName, colorFamily, page, pageSize: 48, sort: 'code',
      // Staff also see colours still waiting for review.
      reviewStatus: isStaff ? undefined : 'approved',
    }),
  ]);
  const basePath = `/collections/${collection.slug}`;
  const query = { fabricName, colorFamily };

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow={mill.name}
        title={collection.name}
        description={collection.description}
        aside={
          <span className="font-mono text-[11px] uppercase tracking-label text-stone">
            {summary.total} {summary.total === 1 ? 'colour' : 'colours'}
          </span>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Link href={`/mills/${mill.slug}`} className="t-label hover:text-ink">
          More from {mill.name}
        </Link>
        {canApprove && summary.pending > 0 && <ApproveCollection slug={collection.slug} pending={summary.pending} />}
      </div>

      <div className="mt-10 space-y-4 border-y border-seam py-6">
        {summary.names.length > 1 && (
          <FilterChips label="Blend" param="fabricName" options={summary.names} current={fabricName} basePath={basePath} query={query} />
        )}
        <FilterChips label="Colour" param="colorFamily" options={summary.colorFamilies} current={colorFamily} basePath={basePath} query={query} />
      </div>

      <div className="mt-10">
        <FabricGrid fabrics={swatches.items} showStatus={isStaff} emptyHint="No colours match these filters." />
      </div>

      <Suspense>
        <Pagination total={swatches.total} page={swatches.page} pageSize={swatches.pageSize} />
      </Suspense>
    </EditorialLayout>
  );
}

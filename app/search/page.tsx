import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { fabricSearchSchema } from '@/features/fabrics/types/fabric.schema';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { embedLookNote } from '@/features/look-search/embed-look';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { FabricSearchBar } from '@/components/search/FabricSearchBar';
import { FabricFilters } from '@/components/search/FabricFilters';
import { LookChips } from '@/components/search/LookChips';
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
  // Photo search is for signed-in users; only they trigger the (tiny) embedding
  // call, so a crafted URL can't run up API use for visitors.
  const lookEmbedding = profile && parsed.look?.length && parsed.lookNote
    ? await embedLookNote(parsed.lookNote)
    : undefined;
  const [fabrics, mills] = await Promise.all([
    services.fabricService.search({
      ...parsed,
      lookEmbedding,
      reviewStatus: parsed.reviewStatus ?? (isStaff ? undefined : 'approved'),
    }),
    services.millService.list(),
  ]);

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="Find a quality"
        title="Search the archive"
        description={`By fabric code, name, fibre, weight, colour, use or mill${profile ? ' — or by photo' : ''}.`}
      />

      {/* Filters sit below the search; while the photo drawer is open they move into
          the empty space beside it (wide screens only). Pure CSS: the photo-open:
          variant in tailwind.config.ts. */}
      <div data-photo-area className="mt-10 grid gap-8 lg:photo-open:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:photo-open:gap-12">
        <div className="flex max-w-2xl flex-col">
          <Suspense>
            <FabricSearchBar photoSearch={!!profile} />
            <LookChips />
          </Suspense>
        </div>
        <Suspense>
          <FabricFilters layout="beside" mills={mills.map((m) => ({ name: m.name, slug: m.slug }))} />
        </Suspense>
      </div>

      <div className="mt-12 flex items-baseline justify-between border-b border-seam pb-3">
        <span className="font-mono text-[11px] uppercase tracking-label text-stone">
          {parsed.look?.length
            ? `${fabrics.total} similar ${fabrics.total === 1 ? 'fabric' : 'fabrics'}, closest first`
            : `${fabrics.total} ${fabrics.total === 1 ? 'result' : 'results'}${parsed.q ? ` for “${parsed.q}”` : ''}`}
        </span>
      </div>

      <div className="mt-8">
        <FabricGrid
          fabrics={fabrics.items}
          showStatus={isStaff}
          emptyHint={parsed.look?.length
            ? 'Nothing close enough — remove a tag above or loosen the filters.'
            : 'Try a broader term — search covers codes, names, compositions and colours.'}
        />
      </div>

      <Suspense>
        <Pagination total={fabrics.total} page={fabrics.page} pageSize={fabrics.pageSize} />
      </Suspense>
    </EditorialLayout>
  );
}

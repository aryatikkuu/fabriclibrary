import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { collectionsConfig } from '@/lib/config/collections.config';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollectionCard } from '@/components/collections/CollectionCard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Collections' };

export default async function CollectionsPage() {
  const services = buildServices(await createClient());
  const isStaff = roleCan((await getCurrentProfile())?.role, 'review.read');
  const mills = await services.millService.list();

  const collections = await Promise.all(
    collectionsConfig.map(async (collection) => {
      const summary = await services.fabricService.collectionSummary(collection.slug);
      // One swatch per colour family, so the strip shows the book's range.
      const preview = await Promise.all(
        summary.colorFamilies.slice(0, 8).map(async (colorFamily) =>
          (await services.fabricService.search({
            collection: collection.slug, colorFamily, sort: 'code', pageSize: 1,
            reviewStatus: isStaff ? undefined : 'approved',
          })).items[0]),
      );
      return {
        collection,
        summary,
        preview: preview.filter(Boolean),
        millName: mills.find((m) => m.slug === collection.millSlug)?.name ?? '',
      };
    }),
  );
  const shown = collections.filter((c) => c.summary.total > 0);

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="Swatch books"
        title="Collections"
        description="A mill's colour cards — one quality in many shades. Pick a colour and request it like any fabric."
      />

      <div className="mt-12">
        {shown.length === 0 ? (
          <EmptyState title="No collections yet" hint="Swatch books appear here once their colours are approved." />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {shown.map(({ collection, summary, preview, millName }) => (
              <CollectionCard key={collection.slug} collection={collection} millName={millName} count={summary.total} preview={preview} />
            ))}
          </div>
        )}
      </div>
    </EditorialLayout>
  );
}

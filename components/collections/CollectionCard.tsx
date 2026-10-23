import Link from 'next/link';
import Image from 'next/image';
import type { CollectionConfig } from '@/lib/config/collections.config';
import type { FabricWithRelations } from '@/types/fabric';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';
import { Arrow } from '@/components/ui/Arrow';

/** Collections index card: a strip of the collection's colours, then its label. */
export function CollectionCard({
  collection, millName, count, preview,
}: {
  collection: CollectionConfig;
  millName: string;
  count: number;
  /** A few swatches for the colour strip. */
  preview: FabricWithRelations[];
}) {
  const images = preview.map((f) => f.images?.find((i) => i.is_primary) ?? f.images?.[0]).filter((i) => i?.public_url);

  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group relative flex flex-col border border-seam bg-paper transition-colors hover:border-ink"
    >
      <span aria-hidden className="absolute left-0 top-0 z-10 h-0 w-0.5 bg-thread transition-all duration-500 group-hover:h-full" />
      <div className="grid h-40 grid-cols-8 gap-px overflow-hidden bg-seam">
        {images.map((image) => (
          <div key={image!.id} className="relative bg-linen">
            <Image src={image!.public_url!} alt="" fill sizes="80px" className="object-cover" />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col justify-between p-9">
        <div>
          <TechnicalLabel>{millName}</TechnicalLabel>
          <h3 className="mt-4 font-display text-2xl leading-tight tracking-display text-ink">{collection.name}</h3>
          <p className="mt-3 text-sm leading-relaxed text-graphite">{collection.description}</p>
        </div>
        <p className="t-label mt-10 group-hover:text-ink">
          {count} {count === 1 ? collection.item.one : collection.item.many} <Arrow />
        </p>
      </div>
    </Link>
  );
}

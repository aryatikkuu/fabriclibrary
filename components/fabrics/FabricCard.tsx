import Link from 'next/link';
import Image from 'next/image';
import type { FabricWithRelations } from '@/types/fabric';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatGsm } from '@/utils/format';

/**
 * Archival specimen card: full-bleed swatch, then a ruled tag line.
 * On hover, the selvedge thread runs across the top of the image.
 */
export function FabricCard({
  fabric,
  showStatus = false,
}: {
  fabric: FabricWithRelations;
  showStatus?: boolean;
}) {
  const primary = fabric.images?.find((i) => i.is_primary) ?? fabric.images?.[0];

  return (
    <Link href={`/fabrics/${fabric.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        {/* selvedge thread — appears on hover */}
        <span
          aria-hidden
          className="absolute left-0 top-0 z-10 h-0.5 w-0 bg-thread transition-all duration-500 group-hover:w-full"
        />
        {primary?.public_url ? (
          <Image
            src={primary.public_url}
            alt={fabric.fabric_name ?? fabric.fabric_code}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="t-label">No image yet</span>
          </div>
        )}
        {showStatus && (
          <div className="absolute left-3 top-3 bg-paper/90 backdrop-blur">
            <StatusBadge status={fabric.review_status} />
          </div>
        )}
      </div>

      <div className="border-b border-seam pb-4 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="t-label">{fabric.fabric_code}</span>
          <span className="font-mono text-[10.5px] text-stone">{formatGsm(fabric.gsm)}</span>
        </div>
        <h3 className="mt-1.5 font-display text-lg leading-snug text-ink group-hover:underline group-hover:decoration-thread group-hover:decoration-1 group-hover:underline-offset-4">
          {fabric.fabric_name ?? 'Unnamed quality'}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-graphite">
          {[fabric.mill?.name, fabric.composition, fabric.width, fabric.color]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </Link>
  );
}

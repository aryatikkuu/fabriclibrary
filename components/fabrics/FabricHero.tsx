import Image from 'next/image';
import type { FabricWithRelations } from '@/types/fabric';
import { CornerFrame } from '@/components/ui/CornerFrame';

/** Oversized plate image, framed with registration brackets. */
export function FabricHero({ fabric }: { fabric: FabricWithRelations }) {
  const primary = fabric.images?.find((i) => i.is_primary) ?? fabric.images?.[0];

  return (
    <CornerFrame className="p-2.5">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-linen md:aspect-[4/5]">
        {primary?.public_url ? (
          <Image
            src={primary.public_url}
            alt={fabric.fabric_name ?? fabric.fabric_code}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 55vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="t-label">No image yet</span>
          </div>
        )}
      </div>
    </CornerFrame>
  );
}

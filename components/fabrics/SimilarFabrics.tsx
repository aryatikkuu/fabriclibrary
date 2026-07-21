import type { FabricSimilarity, FabricWithRelations } from '@/types/fabric';
import { FabricCard } from './FabricCard';

export function SimilarFabrics({
  items,
}: {
  items: { similarity: FabricSimilarity; fabric: FabricWithRelations }[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-20">
      <div className="flex items-baseline justify-between border-b border-ink pb-3">
        <h2 className="font-display text-2xl text-ink">Similar qualities</h2>
        <span className="font-mono text-[11px] uppercase tracking-label text-stone">
          Matched on type · weight · fibre
        </span>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3">
        {items.map(({ similarity, fabric }) => (
          <div key={similarity.id}>
            <FabricCard fabric={fabric} />
            <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-stone">
              {Math.round(similarity.similarity_score)}% match
              {similarity.similarity_reason ? ` — ${similarity.similarity_reason.split(';')[0]}` : ''}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

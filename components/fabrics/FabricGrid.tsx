import type { FabricWithRelations } from '@/types/fabric';
import { FabricCard } from './FabricCard';
import { EmptyState } from '@/components/ui/EmptyState';

export function FabricGrid({
  fabrics,
  showStatus = false,
  emptyHint,
}: {
  fabrics: FabricWithRelations[];
  showStatus?: boolean;
  emptyHint?: string;
}) {
  if (fabrics.length === 0) {
    return <EmptyState title="No fabrics here yet" hint={emptyHint ?? 'Upload a hanger photo and the archive fills itself.'} />;
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
      {fabrics.map((fabric) => (
        <FabricCard key={fabric.id} fabric={fabric} showStatus={showStatus} />
      ))}
    </div>
  );
}

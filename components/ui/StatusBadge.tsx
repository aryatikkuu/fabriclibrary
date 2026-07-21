import { reviewStatusLabel } from '@/utils/format';
import type { ReviewStatus } from '@/types/fabric';

const styles: Record<ReviewStatus, string> = {
  approved: 'text-approve border-approve/40',
  needs_review: 'text-review border-review/40',
  rejected: 'text-reject border-reject/40',
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-label ${styles[status]}`}
    >
      {reviewStatusLabel(status)}
    </span>
  );
}

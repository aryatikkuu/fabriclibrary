import { formatConfidence } from '@/utils/format';

/** AI extraction confidence, styled like a lab reading. */
export function ConfidenceBadge({ score }: { score: number | null }) {
  const tone =
    score == null ? 'text-stone' : score >= 90 ? 'text-approve' : score >= 75 ? 'text-graphite' : 'text-review';
  return (
    <span className={`font-mono text-[11px] tracking-wide ${tone}`} title="AI extraction confidence">
      AI {formatConfidence(score)}
    </span>
  );
}

import type { FabricWithRelations } from '@/types/fabric';
import { formatDate, formatGsm } from '@/utils/format';

/**
 * The spec strip — set like a mill testing report. Row numbers in mono,
 * labels in tracked caps, values in serif. Reads as a printed document.
 */
export function FabricTechnicalData({ fabric }: { fabric: FabricWithRelations }) {
  const rows: [string, string][] = [
    ['Mill', fabric.mill?.name ?? '—'],
    ['Fabric type', fabric.fabric_type ?? '—'],
    ['Composition', fabric.composition ?? '—'],
    ['Weight', formatGsm(fabric.gsm)],
    ['Width', fabric.width ?? '—'],
    ['Colour', [fabric.color, fabric.color_family && `(${fabric.color_family})`].filter(Boolean).join(' ') || '—'],
    ['Season', fabric.season ?? '—'],
    ['Use', fabric.suggested_use ?? '—'],
    ['Added', formatDate(fabric.created_at)],
  ];

  const tags = fabric.tags ?? [];

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <span className="t-label text-ink">[ Spec sheet ]</span>
        <span className="font-mono text-[10.5px] text-stone">{fabric.fabric_code}</span>
      </div>
      <dl>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className="grid grid-cols-[2rem_120px_1fr] items-baseline gap-4 border-b border-seam py-3.5 md:grid-cols-[2.5rem_160px_1fr]"
          >
            <span aria-hidden className="font-mono text-[10px] text-stone">
              {String(i + 1).padStart(2, '0')}
            </span>
            <dt className="t-label">{label}</dt>
            <dd className="font-display text-base text-ink">{value}</dd>
          </div>
        ))}
        {tags.length > 0 && (
          <div className="grid grid-cols-[2rem_120px_1fr] items-baseline gap-4 border-b border-seam py-3.5 md:grid-cols-[2.5rem_160px_1fr]">
            <span aria-hidden className="font-mono text-[10px] text-stone">
              {String(rows.length + 1).padStart(2, '0')}
            </span>
            <dt className="t-label">Tags</dt>
            <dd className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="border border-seam px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-label text-graphite"
                >
                  {t.tag}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

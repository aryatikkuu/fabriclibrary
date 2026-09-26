import type { ReactNode } from 'react';

/** Heavy-ruled section heading used on the home page: display title left, a label or link right. */
export function SectionHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
      <h2 className="font-display text-3xl tracking-display text-ink">{title}</h2>
      {aside}
    </div>
  );
}

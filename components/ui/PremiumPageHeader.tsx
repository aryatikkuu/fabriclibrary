import type { ReactNode } from 'react';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

/** Editorial page header: crosshair eyebrow, oversized display title. */
export function PremiumPageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="border-b border-seam pb-12 pt-20 md:pt-24">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-4xl">
          {eyebrow && <TechnicalLabel crosshair className="mb-5">{eyebrow}</TechnicalLabel>}
          <h1 className="display-page">{title}</h1>
          {description && (
            <p className="mt-6 max-w-xl text-base leading-relaxed text-graphite">{description}</p>
          )}
        </div>
        {aside && <div>{aside}</div>}
      </div>
    </header>
  );
}

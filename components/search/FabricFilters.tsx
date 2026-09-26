'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { searchConfig } from '@/lib/config/search.config';

interface FilterOption { value: string; label: string }

/**
 * One height for selects and number inputs, so every filter row lines up.
 * 16 px text on phones: iPhone Safari zooms into any smaller field when tapped.
 */
const FIELD = 'h-9 border border-seam bg-paper px-2 text-base text-ink focus:border-ink focus:outline-none sm:text-sm';

function Select({
  name, label, options, value, onChange, className = '',
}: {
  name: string; label: string; options: FilterOption[]; value: string;
  onChange: (name: string, value: string) => void; className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-label text-stone">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className={FIELD}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** GSM is applied on blur, so typing "180" doesn't search for 1, 18, 180. */
function NumberField({
  name, label, value, onChange,
}: {
  name: string; label: string; value: string; onChange: (name: string, value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-label text-stone">{label}</span>
      <input type="number" defaultValue={value} min={searchConfig.gsm.min} max={searchConfig.gsm.max}
        onBlur={(e) => onChange(name, e.target.value)} className={FIELD} />
    </label>
  );
}

const ROW = 'grid grid-cols-2 gap-4 border-y border-seam py-5 md:grid-cols-3 lg:grid-cols-5';

const LAYOUTS = {
  /** Full-width band under the search. */
  row: ROW,
  /**
   * The same band, but on wide screens it becomes a column while the photo
   * drawer is open (the page moves it beside the search bar — see app/search/page.tsx).
   */
  // content-between: first row level with the top of the search bar, last row with the bottom of the drawer.
  beside: `${ROW} lg:photo-open:grid-cols-2 lg:photo-open:content-between lg:photo-open:border-y-0 lg:photo-open:py-0`,
};

/** Filter rail driven entirely by search.config — no hardcoded options. */
export function FabricFilters({
  mills,
  layout = 'row',
}: {
  mills: { name: string; slug: string }[];
  layout?: keyof typeof LAYOUTS;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  const toOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

  return (
    <div className={LAYOUTS[layout]}>
      <Select name="millSlug" label="Mill" value={searchParams.get('millSlug') ?? ''}
        options={mills.map((m) => ({ value: m.slug, label: m.name }))} onChange={setParam}
        className={`col-span-2 lg:col-span-1 ${layout === 'beside' ? 'lg:photo-open:col-span-2' : ''}`} />
      <Select name="fabricType" label="Fabric type" value={searchParams.get('fabricType') ?? ''}
        options={toOptions(searchConfig.fabricTypes)} onChange={setParam} />
      <Select name="colorFamily" label="Colour" value={searchParams.get('colorFamily') ?? ''}
        options={toOptions(searchConfig.colorFamilies)} onChange={setParam} />
      <NumberField name="gsmMin" label="GSM min" value={searchParams.get('gsmMin') ?? ''} onChange={setParam} />
      <NumberField name="gsmMax" label="GSM max" value={searchParams.get('gsmMax') ?? ''} onChange={setParam} />
    </div>
  );
}

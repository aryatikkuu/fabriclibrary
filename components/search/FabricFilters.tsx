'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { searchConfig } from '@/lib/config/search.config';

interface FilterOption { value: string; label: string }

const FIELD = 'border border-seam bg-paper px-2 py-1.5 text-sm text-ink focus:border-ink focus:outline-none';

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

const LAYOUTS = {
  /** Full-width band under the search (mill pages). */
  row: 'grid grid-cols-2 gap-4 border-y border-seam py-5 md:grid-cols-3 lg:grid-cols-5',
  /** Beside the search bar on wide screens (search page); a band below it on small ones. */
  column: 'grid grid-cols-2 gap-4 border-y border-seam py-5 md:grid-cols-3 lg:grid-cols-2 lg:border-y-0 lg:py-0',
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
        className={layout === 'column' ? 'lg:col-span-2' : ''} />
      <Select name="fabricType" label="Fabric type" value={searchParams.get('fabricType') ?? ''}
        options={toOptions(searchConfig.fabricTypes)} onChange={setParam} />
      <Select name="colorFamily" label="Colour" value={searchParams.get('colorFamily') ?? ''}
        options={toOptions(searchConfig.colorFamilies)} onChange={setParam} />
      <NumberField name="gsmMin" label="GSM min" value={searchParams.get('gsmMin') ?? ''} onChange={setParam} />
      <NumberField name="gsmMax" label="GSM max" value={searchParams.get('gsmMax') ?? ''} onChange={setParam} />
    </div>
  );
}

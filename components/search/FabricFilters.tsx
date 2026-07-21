'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { searchConfig } from '@/lib/config/search.config';

interface FilterOption { value: string; label: string }

function Select({
  name, label, options, value, onChange,
}: {
  name: string; label: string; options: FilterOption[]; value: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-label text-stone">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="border border-seam bg-paper px-2 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Filter rail driven entirely by search.config — no hardcoded options. */
export function FabricFilters({ mills }: { mills: { name: string; slug: string }[] }) {
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
    <div className="grid grid-cols-2 gap-4 border-y border-seam py-5 md:grid-cols-3 lg:grid-cols-5">
      <Select name="millSlug" label="Mill" value={searchParams.get('millSlug') ?? ''}
        options={mills.map((m) => ({ value: m.slug, label: m.name }))} onChange={setParam} />
      <Select name="fabricType" label="Fabric type" value={searchParams.get('fabricType') ?? ''}
        options={toOptions(searchConfig.fabricTypes)} onChange={setParam} />
      <Select name="colorFamily" label="Colour" value={searchParams.get('colorFamily') ?? ''}
        options={toOptions(searchConfig.colorFamilies)} onChange={setParam} />
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-label text-stone">GSM min</span>
        <input type="number" defaultValue={searchParams.get('gsmMin') ?? ''} min={searchConfig.gsm.min} max={searchConfig.gsm.max}
          onBlur={(e) => setParam('gsmMin', e.target.value)}
          className="border border-seam bg-paper px-2 py-1.5 text-sm text-ink focus:border-ink focus:outline-none" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-label text-stone">GSM max</span>
        <input type="number" defaultValue={searchParams.get('gsmMax') ?? ''} min={searchConfig.gsm.min} max={searchConfig.gsm.max}
          onBlur={(e) => setParam('gsmMax', e.target.value)}
          className="border border-seam bg-paper px-2 py-1.5 text-sm text-ink focus:border-ink focus:outline-none" />
      </label>
    </div>
  );
}

import Link from 'next/link';

/**
 * One row of filter links ("All", then each option) that set a single URL
 * parameter and keep the others; picking a filter starts again at page 1.
 */
export function FilterChips({
  label, param, options, current, basePath, query,
}: {
  label: string;
  param: string;
  options: string[];
  current?: string;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  const href = (value?: string) => {
    const params = new URLSearchParams(
      Object.entries({ ...query, [param]: value, page: undefined }).filter((e): e is [string, string] => !!e[1]),
    );
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const chip = (active: boolean) =>
    `border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-label transition-colors ${
      active ? 'border-ink bg-ink text-paper' : 'border-seam text-graphite hover:border-ink hover:text-ink'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="field-label mr-2 w-full sm:w-28">{label}</span>
      <Link href={href()} className={chip(!current)} scroll={false}>All</Link>
      {options.map((option) => (
        <Link key={option} href={href(option)} className={chip(current === option)} scroll={false}>
          {option}
        </Link>
      ))}
    </div>
  );
}

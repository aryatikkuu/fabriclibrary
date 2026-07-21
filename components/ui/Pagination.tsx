'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/** Quiet prev/next pagination that preserves the active query string. */
export function Pagination({
  total,
  page,
  pageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  function hrefFor(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(target));
    return `${pathname}?${params.toString()}`;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-16 flex items-center justify-between border-t border-seam pt-6 font-mono text-[11px] uppercase tracking-label"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="text-graphite hover:text-ink">
          ← Previous
        </Link>
      ) : (
        <span className="text-seam">← Previous</span>
      )}
      <span className="text-stone">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="text-graphite hover:text-ink">
          Next →
        </Link>
      ) : (
        <span className="text-seam">Next →</span>
      )}
    </nav>
  );
}

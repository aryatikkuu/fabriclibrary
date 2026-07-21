import Link from 'next/link';
import { EditorialLayout } from '@/components/layout/EditorialLayout';

export default function NotFound() {
  return (
    <EditorialLayout>
      <div className="pt-28">
        <p className="font-mono text-[11px] uppercase tracking-label text-stone">404</p>
        <h1 className="mt-4 font-display text-5xl text-ink">Not in the archive</h1>
        <p className="mt-4 max-w-md text-graphite">
          This record doesn&apos;t exist, or it was removed. Try the search instead.
        </p>
        <Link
          href="/search"
          className="mt-8 inline-block border border-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-label text-ink hover:bg-ink hover:text-paper"
        >
          Search fabrics →
        </Link>
      </div>
    </EditorialLayout>
  );
}

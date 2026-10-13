'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Staff only: approve every pending swatch of a collection in one go. */
export function ApproveCollection({ slug, pending }: { slug: string; pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function approve() {
    if (!window.confirm(`Approve all ${pending} pending swatches in this collection?`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/collections/${slug}/approve`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Request failed');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={approve} disabled={busy} className="btn-technical btn-technical--thread disabled:opacity-50">
        {busy ? 'Approving…' : `Approve all ${pending} pending`}
      </button>
      {error && <span className="text-xs text-thread">{error}</span>}
    </div>
  );
}

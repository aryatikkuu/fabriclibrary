'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { FabricWithRelations } from '@/types/fabric';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { EmptyState } from '@/components/ui/EmptyState';

const EDITABLE_FIELDS = [
  ['fabric_code', 'Fabric code'],
  ['fabric_name', 'Fabric name'],
  ['fabric_type', 'Fabric type'],
  ['composition', 'Composition'],
  ['gsm', 'GSM'],
  ['width', 'Width'],
  ['color', 'Colour'],
  ['color_family', 'Colour family'],
  ['season', 'Season'],
  ['suggested_use', 'Use'],
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number][0];

function ReviewRow({ fabric, onResolved }: { fabric: FabricWithRelations; onResolved: (id: string) => void }) {
  const [edits, setEdits] = useState<Partial<Record<EditableField, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const image = fabric.images?.find((i) => i.is_primary) ?? fabric.images?.[0];

  async function call(path: string, method: string, body?: unknown) {
    setBusy(path);
    setError('');
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Request failed');
      }
      onResolved(fabric.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  const corrections = Object.fromEntries(
    Object.entries(edits).filter(([, v]) => v !== undefined && v !== ''),
  );

  return (
    <div className="grid gap-6 border border-seam bg-paper p-6 md:grid-cols-[200px_1fr]">
      <div>
        <div className="relative aspect-[4/5] overflow-hidden bg-linen">
          {image?.public_url && (
            <Image src={image.public_url} alt={fabric.fabric_code} fill sizes="200px" className="object-cover" />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Link href={`/fabrics/${fabric.id}`} className="font-mono text-[11px] uppercase tracking-label text-graphite hover:text-ink">
            View record
          </Link>
          <ConfidenceBadge score={fabric.extraction_confidence} />
        </div>
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {EDITABLE_FIELDS.map(([field, label]) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-label text-stone">{label}</span>
              <input
                defaultValue={(fabric[field] as string | number | null) ?? ''}
                onChange={(e) => setEdits((prev) => ({ ...prev, [field]: e.target.value }))}
                className="border border-seam bg-paper px-2 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
              />
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-reject">{error}</p>}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={busy !== null}
            onClick={() => call(`/api/review-queue/${fabric.id}/approve`, 'PATCH', corrections)}
            className="border border-approve px-4 py-2 font-mono text-[11px] uppercase tracking-label text-approve hover:bg-approve hover:text-paper disabled:opacity-50"
          >
            {busy?.includes('approve') ? 'Approving…' : 'Approve'}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => call(`/api/review-queue/${fabric.id}/rerun`, 'POST')}
            className="border border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-label text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {busy?.includes('rerun') ? 'Re-reading…' : 'Re-run AI'}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => call(`/api/review-queue/${fabric.id}/reject`, 'PATCH')}
            className="border border-reject px-4 py-2 font-mono text-[11px] uppercase tracking-label text-reject hover:bg-reject hover:text-paper disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewQueueTable({ initialItems }: { initialItems: FabricWithRelations[] }) {
  const [items, setItems] = useState(initialItems);

  if (items.length === 0) {
    return <EmptyState title="Review queue is clear" hint="New low-confidence extractions will appear here." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {items.map((fabric) => (
        <ReviewRow
          key={fabric.id}
          fabric={fabric}
          onResolved={(id) => setItems((prev) => prev.filter((f) => f.id !== id))}
        />
      ))}
    </div>
  );
}

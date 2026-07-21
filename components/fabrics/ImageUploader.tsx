'use client';

import { useState } from 'react';

/** Manual upload for staff — the n8n folder watcher is the primary route. */
export function ImageUploader({ millSlug, fabricCode }: { millSlug: string; fabricCode: string }) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    const form = new FormData();
    form.append('file', file);
    form.append('mill_slug', millSlug);
    form.append('fabric_code', fabricCode);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Upload failed');
      }
      setStatus('done');
      setMessage('Image uploaded. Refresh to see it.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    }
  }

  return (
    <div className="border border-seam p-4">
      <label className="font-mono text-[11px] uppercase tracking-label text-stone">
        Add image
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          disabled={status === 'uploading'}
          className="mt-2 block w-full text-xs text-graphite file:mr-3 file:border file:border-ink file:bg-paper file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:uppercase file:tracking-label hover:file:bg-ink hover:file:text-paper"
        />
      </label>
      {message && (
        <p className={`mt-2 text-xs ${status === 'error' ? 'text-reject' : 'text-approve'}`}>{message}</p>
      )}
    </div>
  );
}

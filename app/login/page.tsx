'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { appConfig } from '@/lib/config/app.config';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-6 pt-24">
      <p className="font-mono text-[11px] uppercase tracking-label text-stone">Staff access</p>
      <h1 className="mt-3 font-display text-4xl text-ink">Sign in</h1>
      <p className="mt-3 text-sm text-graphite">
        Accounts are created by an administrator in Supabase. The public archive is open without
        signing in.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-label text-stone">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="border-b-2 border-seam bg-transparent py-2 font-display text-lg text-ink focus:border-ink focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-label text-stone">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="border-b-2 border-seam bg-transparent py-2 font-display text-lg text-ink focus:border-ink focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-reject">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 border border-ink bg-ink px-6 py-3 font-mono text-[11px] uppercase tracking-label text-paper transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
        >
          {loading ? 'Signing in…' : `Enter ${appConfig.name}`}
        </button>
      </form>
    </div>
  );
}

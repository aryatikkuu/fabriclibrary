'use client';

import { useState } from 'react';
import type { FabricWithRelations } from '@/types/fabric';
import { FabricGrid } from '@/components/fabrics/FabricGrid';
import { LoadingState } from '@/components/ui/LoadingState';

interface Exchange {
  question: string;
  answer: string;
  items: FabricWithRelations[];
}

const EXAMPLES = [
  'Show me all 180 GSM cotton jerseys',
  'Navy satin fabrics',
  'Find alternatives to BWR01',
  'All interlocks from Masood',
  'Fabrics between 160 and 200 GSM',
];

export function AssistantChat() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? 'Search failed');
      setHistory((prev) => [
        { question: q, answer: data.answer, items: data.items ?? [] },
        ...prev,
      ]);
      setQuestion('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); void ask(question); }}
        className="flex border-b-2 border-ink"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the archive — e.g. show recycled polyester qualities…"
          aria-label="Ask the fabric assistant"
          className="w-full bg-transparent py-3 font-display text-xl text-ink placeholder:text-stone focus:outline-none"
        />
        <button type="submit" disabled={loading} className="px-4 font-mono text-[11px] uppercase tracking-label text-graphite hover:text-ink disabled:opacity-50">
          Ask
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            onClick={() => void ask(example)}
            className="border border-seam px-3 py-1.5 text-xs text-graphite hover:border-ink hover:text-ink"
          >
            {example}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-reject">{error}</p>}
      {loading && <LoadingState label="Reading the archive" />}

      <div className="mt-10 flex flex-col gap-14">
        {history.map((exchange, index) => (
          <section key={index}>
            <p className="font-mono text-[11px] uppercase tracking-label text-stone">You asked</p>
            <p className="mt-1 font-display text-xl text-ink">{exchange.question}</p>
            <p className="mt-2 text-sm text-graphite">{exchange.answer} — {exchange.items.length} result{exchange.items.length === 1 ? '' : 's'}</p>
            <div className="mt-6">
              <FabricGrid fabrics={exchange.items} emptyHint="Try widening the GSM range or removing a filter." />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

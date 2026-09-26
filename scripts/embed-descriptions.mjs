#!/usr/bin/env node
/**
 * Embed every fabric's AI description for photo search (migration 0008).
 *
 * Usage: npm run embed [-- --all]
 * Only fabrics whose description is new or changed since it was last embedded
 * are sent, so re-running after `npm run verify-tag -- --save` is cheap.
 * --all re-embeds everything (needed after changing lookSearch.embeddingModel).
 * Cost: text-embedding-3-small is $0.02 per 1M tokens — the whole library is
 * about 0.2¢. Stops if a run would exceed --budget USD (default 0.10).
 */

import { adminClient, flag, hasFlag, selectAll } from './lib/common.mjs';
import { lookSearch } from '../lib/config/visual-tags.config.ts';

const all = hasFlag('all');
const BUDGET = Number(flag('budget', 0.1));
const PRICE_PER_M = { 'text-embedding-3-small': 0.02, 'text-embedding-3-large': 0.13 }[lookSearch.embeddingModel];
if (PRICE_PER_M == null) throw new Error(`Add the price of ${lookSearch.embeddingModel} to embed-descriptions.mjs`);
const BATCH = 500;

const db = adminClient();

async function embed(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: lookSearch.embeddingModel, input: texts }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message ?? res.statusText);
  return { vectors: body.data.map((d) => d.embedding), tokens: body.usage.total_tokens };
}

const [fabrics, existing] = await Promise.all([
  selectAll(db, 'fabrics', 'id, ai_description'),
  selectAll(db, 'fabric_embeddings', 'fabric_id, source_text, model', 'fabric_id'),
]);
const done = new Map(existing.map((e) => [e.fabric_id, e]));
const todo = fabrics.filter((f) => {
  const text = f.ai_description?.trim();
  if (!text) return false;
  const e = done.get(f.id);
  return all || !e || e.source_text !== text || e.model !== lookSearch.embeddingModel;
});

// ~4 characters per token; refuse up front rather than stop half way.
const estimate = (todo.reduce((n, f) => n + f.ai_description.length, 0) / 4) * PRICE_PER_M / 1e6;
console.log(`${todo.length} of ${fabrics.length} fabrics to embed (est. $${estimate.toFixed(4)}, budget $${BUDGET})`);
if (estimate > BUDGET) {
  console.error('Estimate exceeds the budget — raise it with --budget.');
  process.exit(1);
}

let spent = 0;
for (let start = 0; start < todo.length; start += BATCH) {
  const chunk = todo.slice(start, start + BATCH);
  const texts = chunk.map((f) => f.ai_description.trim());
  const { vectors, tokens } = await embed(texts);
  spent += (tokens * PRICE_PER_M) / 1e6;
  const rows = chunk.map((f, j) => ({
    fabric_id: f.id,
    embedding: JSON.stringify(vectors[j]),
    source_text: texts[j],
    model: lookSearch.embeddingModel,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from('fabric_embeddings').upsert(rows, { onConflict: 'fabric_id' });
  if (error) throw new Error(`save: ${error.message}`);
  console.log(`  ${Math.min(start + BATCH, todo.length)}/${todo.length}  spent $${spent.toFixed(4)}`);
}
console.log(`Done. Spent $${spent.toFixed(4)}.`);

/**
 * Shared helpers for the maintenance scripts in scripts/. Anything two scripts
 * need lives here, or in the app's own config (lib/config/*, features/*) which
 * the scripts import directly — run them via the npm scripts in package.json,
 * which pass Node's --experimental-strip-types so .ts config can be imported.
 * Scripts run from the repo root.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

/** Load .env.local / .env without overriding variables already set. */
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

/**
 * Every public table, parents before children (backup.mjs dumps, restore.mjs replays in this order).
 * fabric_embeddings is left out on purpose: it is derived data, rebuilt by `npm run embed`.
 */
export const TABLES = [
  'mills',
  'profiles',
  'fabrics',
  'fabric_images',
  'fabric_documents',
  'fabric_tags',
  'fabric_similarities',
  'ai_extraction_logs',
  'audit_logs',
];

export const STORAGE_BUCKET = () => process.env.STORAGE_BUCKET_NAME ?? 'textile-library';

/** Service-role client — bypasses RLS, so only ever used from local scripts. */
export function adminClient() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
        'Copy .env.example to .env.local and fill in your Supabase project keys.',
    );
    process.exit(1);
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Every row of a table. Supabase caps a select at 1,000 rows, so page through
 * (ordered by a unique column so pages don't overlap; pass orderBy for tables keyed on something else).
 */
export async function selectAll(db, table, columns = '*', orderBy = 'id') {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).order(orderBy).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/** Hanger photo formats the pipeline reads. */
export const isImageFile = (name) => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(name).toLowerCase());

export const contentTypeFor = (name) => CONTENT_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream';

/**
 * Run fn over items with at most `limit` in flight; results keep input order.
 * A rejected item becomes { error: message } instead of stopping the rest.
 */
export async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await Promise.resolve()
        .then(() => fn(items[i], i))
        .catch((e) => ({ error: e.message ?? String(e) }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Every object in a storage bucket as { path, size }. list() is per-folder, so walk the tree, folders in parallel. */
export async function listStorage(db, bucket, prefix = '') {
  const PAGE = 1000;
  const files = [];
  const folders = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`storage ${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) folders.push(path); // folders have no id
      else files.push({ path, size: item.metadata?.size ?? null });
    }
    if (data.length < PAGE) break;
  }
  for (const sub of await mapPool(folders, 8, (f) => listStorage(db, bucket, f))) {
    if (sub.error) throw new Error(sub.error);
    files.push(...sub);
  }
  return files;
}

/** Levenshtein distance: the fewest single-character edits turning a into b. */
export function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

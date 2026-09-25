#!/usr/bin/env node
/**
 * Load a scripts/backup.mjs snapshot into the Supabase project in .env.local.
 *
 * Usage: npm run restore -- backups/<YYYY-MM-DD_HHMM> [--confirm]
 *
 * Without --confirm it is a dry run: it prints the target project and the row
 * counts it would write, and changes nothing.
 *
 * Behaviour:
 *   - Tables are upserted on `id` in dependency order (see TABLES in lib/common.mjs).
 *     Rows that exist in the target get the backup's values; rows that exist only
 *     in the target are left alone (nothing is deleted).
 *   - The schema must already exist: run database/migrations/* on a new project first.
 *   - profiles are tied to Supabase Auth users, which a table backup cannot carry.
 *     Profiles whose auth user is missing are skipped, and references to them
 *     (fabrics.created_by, audit_logs.user_id) are set to null.
 *   - With a --with-files backup, storage objects are re-uploaded too; otherwise
 *     re-upload photos with bulk-insert.mjs from the original photo folders.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { adminClient, contentTypeFor, STORAGE_BUCKET, TABLES } from './lib/common.mjs';

const [, , dirArg] = process.argv;
const confirm = process.argv.includes('--confirm');
if (!dirArg || !existsSync(join(dirArg, 'manifest.json'))) {
  console.error('Usage: npm run restore -- backups/<snapshot folder> [--confirm]');
  process.exit(1);
}
const dir = resolve(dirArg);
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const db = adminClient();
const CHUNK = 500;

/** Columns pointing at profiles, which may not survive a move to a new project. */
const PROFILE_REFS = { fabrics: 'created_by', audit_logs: 'user_id' };

const load = (table) => JSON.parse(readFileSync(join(dir, `${table}.json`), 'utf8'));

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' });
    if (error) throw new Error(`${table} rows ${i}-${i + CHUNK}: ${error.message}`);
  }
}

/** One at a time: a profile fails on its own if its auth user is gone. */
async function restoreProfiles(rows) {
  const kept = new Set();
  for (const row of rows) {
    const { error } = await db.from('profiles').upsert(row, { onConflict: 'id' });
    if (error) console.warn(`  skipped profile ${row.id} (${row.email ?? 'no email'}): ${error.message}`);
    else kept.add(row.id);
  }
  return kept;
}

async function main() {
  console.log(`Snapshot:  ${dir} (taken ${manifest.created_at})`);
  console.log(`Target:    ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  for (const t of TABLES) console.log(`  ${t}: ${manifest.tables[t] ?? 0} rows`);
  if (!confirm) {
    console.log('\nDry run — nothing written. Re-run with --confirm to restore.');
    return;
  }

  let profileIds = new Set();
  for (const table of TABLES) {
    let rows = load(table);
    if (table === 'profiles') {
      profileIds = await restoreProfiles(rows);
      console.log(`profiles: ${profileIds.size}/${rows.length}`);
      continue;
    }
    const ref = PROFILE_REFS[table];
    if (ref) rows = rows.map((r) => (r[ref] && !profileIds.has(r[ref]) ? { ...r, [ref]: null } : r));
    await upsert(table, rows);
    console.log(`${table}: ${rows.length}`);
  }

  if (manifest.files_included) {
    const bucket = STORAGE_BUCKET();
    const paths = JSON.parse(readFileSync(join(dir, 'storage-index.json'), 'utf8'));
    for (const [i, path] of paths.entries()) {
      const { error } = await db.storage.from(bucket).upload(path, readFileSync(join(dir, 'files', path)), {
        contentType: contentTypeFor(path),
        upsert: true,
      });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      if ((i + 1) % 250 === 0) console.log(`  files ${i + 1}/${paths.length}`);
    }
  }
  console.log('Restore complete.');
}

main().catch((e) => {
  console.error('Restore FAILED:', e.message);
  process.exit(1);
});

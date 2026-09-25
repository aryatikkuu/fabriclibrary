#!/usr/bin/env node
/**
 * Snapshot the library's data to a dated local folder.
 *
 * Usage: npm run backup [-- --with-files]
 *
 * Writes backups/<YYYY-MM-DD_HHMM>/:
 *   <table>.json          every row of each public table (paginated past the 1,000-row cap)
 *   storage-index.json    every object path in the storage bucket
 *   state/                the resumable pipeline files (.extraction-progress-*),
 *                         which record paid-for AI output and are cheap to keep
 *   files/                (only with --with-files) a copy of every storage object
 *   manifest.json         row/file counts, so a restore can be sanity-checked
 *
 * Storage objects are skipped by default: fabric photos can be re-uploaded from
 * the originals. Copy the whole folder somewhere off this machine (e.g. Google
 * Drive). backups/ is git-ignored because it contains user profiles and audit
 * logs. Restore with scripts/restore.mjs.
 */

import { mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { adminClient, listStorage, mapPool, selectAll, STORAGE_BUCKET, TABLES } from './lib/common.mjs';

const withFiles = process.argv.includes('--with-files');
const db = adminClient();
const bucket = STORAGE_BUCKET();

async function downloadAll(paths, dir) {
  let done = 0;
  const results = await mapPool(paths, 8, async (path) => {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error) throw new Error(`download ${path}: ${error.message}`);
    const out = join(dir, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await data.arrayBuffer()));
    if (++done % 250 === 0) console.log(`  files ${done}/${paths.length}`);
  });
  const failed = results.filter((r) => r?.error);
  if (failed.length) throw new Error(`${failed.length} downloads failed, e.g. ${failed[0].error}`);
}

async function main() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`; // local time
  const dir = resolve(process.cwd(), 'backups', stamp);
  mkdirSync(join(dir, 'state'), { recursive: true });

  const manifest = { created_at: new Date().toISOString(), bucket, tables: {}, storage_objects: 0, files_included: withFiles, state_files: [] };

  for (const table of TABLES) {
    const rows = await selectAll(db, table);
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows));
    manifest.tables[table] = rows.length;
    console.log(`${table}: ${rows.length}`);
  }

  const paths = (await listStorage(db, bucket)).map((f) => f.path);
  writeFileSync(join(dir, 'storage-index.json'), JSON.stringify(paths));
  manifest.storage_objects = paths.length;
  console.log(`storage objects: ${paths.length}`);

  for (const f of readdirSync(process.cwd())) {
    if (/^\.extraction-progress-.+\.json$/.test(f)) {
      copyFileSync(f, join(dir, 'state', f));
      manifest.state_files.push(f);
    }
  }

  if (withFiles) await downloadAll(paths, join(dir, 'files'));

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Backup written to ${dir}`);
}

main().catch((e) => {
  console.error('Backup FAILED:', e.message);
  process.exit(1);
});

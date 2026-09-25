#!/usr/bin/env node
/**
 * Snapshot the library's data to a dated local folder.
 *
 * Usage: npm run backup [-- --with-files]
 *
 * Writes backups/<YYYY-MM-DD_HHMM>/:
 *   <table>.json          every row of each public table (paginated past the 1,000-row cap)
 *   storage-index.json    every object path in the storage bucket
 *   state/                the resumable pipeline files (.extraction-progress-*, .crop-boxes-*),
 *                         which record paid-for AI output and are cheap to keep
 *   files/                (only with --with-files) a copy of every storage object
 *   manifest.json         row/file counts, so a restore can be sanity-checked
 *
 * Storage objects are skipped by default: fabric photos can be re-uploaded from
 * the originals and crops rebuilt from the crop-box files. Copy the whole folder
 * somewhere off this machine (e.g. Google Drive). backups/ is git-ignored because
 * it contains user profiles and audit logs. Restore with scripts/restore.mjs.
 */

import { mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { adminClient, mapPool, selectAll, STORAGE_BUCKET, TABLES } from './lib/common.mjs';

const PAGE = 1000;
const withFiles = process.argv.includes('--with-files');
const db = adminClient();
const bucket = STORAGE_BUCKET();

/** Storage list() is per-folder, so walk the tree — folders in parallel. */
async function listObjects(prefix = '') {
  const files = [];
  const folders = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`storage ${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      (item.id === null ? folders : files).push(path); // folders have no id
    }
    if (data.length < PAGE) break;
  }
  for (const sub of await mapPool(folders, 8, listObjects)) {
    if (sub.error) throw new Error(sub.error);
    files.push(...sub);
  }
  return files;
}

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

  const paths = await listObjects();
  writeFileSync(join(dir, 'storage-index.json'), JSON.stringify(paths));
  manifest.storage_objects = paths.length;
  console.log(`storage objects: ${paths.length}`);

  for (const f of readdirSync(process.cwd())) {
    if (/^\.(extraction-progress|crop-boxes)-.+\.json$/.test(f)) {
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

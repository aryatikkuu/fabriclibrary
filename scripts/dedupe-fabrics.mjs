#!/usr/bin/env node
/**
 * Merge duplicate fabric records and tidy image rows.
 *
 * Usage: npm run dedupe [-- --apply]
 * Dry run by default: prints what it would do and writes the plan to
 * backups/dedupe-<stamp>.json. Take a backup (npm run backup) before --apply.
 *
 * Duplicates it merges (per mill):
 *   same-code   codes identical once case/punctuation/spaces are ignored
 *               ("SLCAF605AA" / "SLCaf605AA", "COL-102, BLACK" / "COL-102-BLACK")
 *   same-photo  the same photo imported twice whose codes differ by a
 *               single OCR slip (edit distance 1, e.g. "2022022-35" / "202022-35")
 * Both require the GSM not to conflict and a specific code: at least 5
 * characters and not a season label, so page/range markers like "PD#4" or
 * "AW 23-24" (shared by unrelated fabrics) never merge. Two-character
 * differences ("JQ-250163" / "JQ-260153", "-01" / "-07") are left for review —
 * they are as likely to be separate colourways as misreads.
 * Photos carrying genuinely different codes are left alone — those are
 * multi-fabric photos (one photo, several labels).
 *
 * In each group the keeper is: approved > needs_review > rejected, then the most
 * complete record, then the highest extraction confidence. Its empty fields are
 * filled from the others; their images and tags move to it; they are deleted.
 *
 * Image tidy-up (all fabrics): the same photo attached twice to one fabric is
 * reduced to one row, and every fabric ends with exactly one primary image.
 * Blank-code "bucket" records (see bulk-insert.mjs) lose any photo that a real
 * record also has.
 *
 * "Same photo" means the same filename within a mill.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { adminClient, editDistance, selectAll } from './lib/common.mjs';

const apply = process.argv.includes('--apply');
const db = adminClient();

const CORE = ['fabric_name', 'fabric_type', 'composition', 'gsm', 'width', 'color', 'color_family', 'season', 'suggested_use', 'description'];
const STATUS_RANK = { approved: 0, needs_review: 1, rejected: 2 };

const normCode = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const gsmCompatible = (a, b) => a.gsm == null || b.gsm == null || a.gsm === b.gsm;
const specificCode = (code) => code.length >= 5 && !/^(AW|SS|FW)\d+$/.test(code);
const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

/** storage_path -> photo identity: "<mill>/<filename>" (mills/<slug>/fabrics/<code>/images/<file>). */
function photoIdentity(storagePath) {
  const parts = storagePath.split('/');
  return `${parts[1]}/${parts[parts.length - 1]}`;
}

function keeperOf(group) {
  const filled = (f) => CORE.filter((k) => !isBlank(f[k])).length;
  return [...group].sort(
    (a, b) =>
      (STATUS_RANK[a.review_status] ?? 1) - (STATUS_RANK[b.review_status] ?? 1) ||
      filled(b) - filled(a) ||
      (b.extraction_confidence ?? 0) - (a.extraction_confidence ?? 0) ||
      String(a.created_at).localeCompare(String(b.created_at)),
  )[0];
}

async function main() {
  const [fabrics, images, tags] = await Promise.all([
    selectAll(db, 'fabrics', 'id, mill_id, fabric_code, review_status, extraction_confidence, created_at, ' + CORE.join(', ')),
    selectAll(db, 'fabric_images', 'id, fabric_id, storage_path, is_primary, uploaded_at'),
    selectAll(db, 'fabric_tags', 'id, fabric_id, tag'),
  ]);
  const byId = new Map(fabrics.map((f) => [f.id, f]));
  const identity = photoIdentity;

  // ---- union-find over duplicate evidence ----
  const parent = new Map(fabrics.map((f) => [f.id, f.id]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const reasons = new Map();
  const union = (a, b, why) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(rb, ra);
    reasons.set(`${a}|${b}`, why);
  };

  const byCode = new Map();
  for (const f of fabrics) {
    const code = normCode(f.fabric_code);
    if (!specificCode(code)) continue;
    const key = `${f.mill_id}|${code}`;
    if (!byCode.has(key)) byCode.set(key, []);
    const peers = byCode.get(key);
    const match = peers.find((p) => gsmCompatible(p, f));
    if (match) union(match.id, f.id, 'same-code');
    peers.push(f);
  }

  const fabricsByPhoto = new Map();
  for (const im of images) {
    const pid = identity(im.storage_path);
    if (!fabricsByPhoto.has(pid)) fabricsByPhoto.set(pid, new Set());
    fabricsByPhoto.get(pid).add(im.fabric_id);
  }
  const blankDetach = []; // image rows on a blank-code record whose photo a real record also has
  for (const [pid, ids] of fabricsByPhoto) {
    if (ids.size < 2) continue;
    const list = [...ids].map((id) => byId.get(id));
    const real = list.filter((f) => normCode(f.fabric_code));
    const blank = list.filter((f) => !normCode(f.fabric_code));
    if (real.length && blank.length) {
      for (const b of blank) blankDetach.push(...images.filter((im) => im.fabric_id === b.id && identity(im.storage_path) === pid));
    }
    for (let i = 0; i < real.length; i++)
      for (let j = i + 1; j < real.length; j++) {
        const [a, b] = [real[i], real[j]];
        const [ca, cb] = [normCode(a.fabric_code), normCode(b.fabric_code)];
        if (a.mill_id === b.mill_id && gsmCompatible(a, b) && specificCode(ca) && specificCode(cb) && editDistance(ca, cb) <= 1) {
          union(a.id, b.id, 'same-photo');
        }
      }
  }

  const groups = new Map();
  for (const f of fabrics) {
    const r = find(f.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(f);
  }
  const merges = [...groups.values()].filter((g) => g.length > 1).map((g) => {
    const keeper = keeperOf(g);
    const losers = g.filter((f) => f.id !== keeper.id);
    const fill = {};
    for (const k of CORE) if (isBlank(keeper[k])) {
      const donor = losers.find((l) => !isBlank(l[k]));
      if (donor) fill[k] = donor[k];
    }
    return { keeper, losers, fill };
  });

  // ---- report ----
  const loserIds = new Set(merges.flatMap((m) => m.losers.map((l) => l.id)));
  console.log(`${fabrics.length} fabrics, ${images.length} image rows`);
  console.log(`Merge groups: ${merges.length} (${loserIds.size} duplicate records to remove)`);
  for (const m of merges.slice(0, 15)) {
    console.log(`  keep ${m.keeper.fabric_code} [${m.keeper.review_status}]  <- ${m.losers.map((l) => `${l.fabric_code} [${l.review_status}]`).join(', ')}`);
  }
  if (merges.length > 15) console.log(`  ... ${merges.length - 15} more in the plan file`);
  console.log(`Blank-code records: ${blankDetach.length} photo rows also attached to a real record (will detach)`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  mkdirSync('backups', { recursive: true });
  const planPath = `backups/dedupe-${stamp}.json`;
  writeFileSync(planPath, JSON.stringify({
    applied: apply,
    merges: merges.map((m) => ({ keeper: m.keeper, removed: m.losers, filled: m.fill })),
    blank_detached: blankDetach,
  }, null, 1));
  console.log(`Plan written to ${planPath}`);

  if (!apply) {
    console.log('\nDry run — nothing changed. Re-run with --apply.');
    return;
  }

  // ---- apply merges ----
  for (const { keeper, losers, fill } of merges) {
    const ids = losers.map((l) => l.id);
    if (Object.keys(fill).length) {
      const { error } = await db.from('fabrics').update(fill).eq('id', keeper.id);
      if (error) throw new Error(`fill ${keeper.fabric_code}: ${error.message}`);
    }
    const moveTags = tags.filter((t) => ids.includes(t.fabric_id)).map((t) => ({ fabric_id: keeper.id, tag: t.tag }));
    if (moveTags.length) {
      const { error } = await db.from('fabric_tags').upsert(moveTags, { onConflict: 'fabric_id,tag', ignoreDuplicates: true });
      if (error) throw new Error(`tags ${keeper.fabric_code}: ${error.message}`);
    }
    const { error: imgErr } = await db.from('fabric_images').update({ fabric_id: keeper.id }).in('fabric_id', ids);
    if (imgErr) throw new Error(`images ${keeper.fabric_code}: ${imgErr.message}`);
    for (const im of images) if (ids.includes(im.fabric_id)) im.fabric_id = keeper.id;
    const { error: delErr } = await db.from('fabrics').delete().in('id', ids);
    if (delErr) throw new Error(`delete ${keeper.fabric_code}: ${delErr.message}`);
  }
  console.log(`Merged ${merges.length} groups.`);

  // ---- image tidy-up ----
  const dropIds = new Set(blankDetach.map((im) => im.id));
  const imagesByFabric = new Map();
  for (const im of images) {
    if (dropIds.has(im.id)) continue;
    if (!imagesByFabric.has(im.fabric_id)) imagesByFabric.set(im.fabric_id, []);
    imagesByFabric.get(im.fabric_id).push(im);
  }
  const setPrimary = [];
  const clearPrimary = [];
  for (const list of imagesByFabric.values()) {
    list.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || String(a.uploaded_at).localeCompare(String(b.uploaded_at)));
    const seen = new Set();
    const kept = [];
    for (const im of list) {
      const pid = identity(im.storage_path);
      if (seen.has(pid)) dropIds.add(im.id);
      else { seen.add(pid); kept.push(im); }
    }
    kept.forEach((im, i) => {
      if (i === 0 && !im.is_primary) setPrimary.push(im.id);
      if (i > 0 && im.is_primary) clearPrimary.push(im.id);
    });
  }
  const chunks = (arr) => Array.from({ length: Math.ceil(arr.length / 200) }, (_, i) => arr.slice(i * 200, i * 200 + 200));
  for (const c of chunks([...dropIds])) {
    const { error } = await db.from('fabric_images').delete().in('id', c);
    if (error) throw new Error(`drop images: ${error.message}`);
  }
  for (const c of chunks(clearPrimary)) {
    const { error } = await db.from('fabric_images').update({ is_primary: false }).in('id', c);
    if (error) throw new Error(`clear primary: ${error.message}`);
  }
  for (const c of chunks(setPrimary)) {
    const { error } = await db.from('fabric_images').update({ is_primary: true }).in('id', c);
    if (error) throw new Error(`set primary: ${error.message}`);
  }
  console.log(`Image rows removed: ${dropIds.size}; primaries fixed: ${clearPrimary.length + setPrimary.length}`);
}

main().catch((e) => {
  console.error('dedupe FAILED:', e.message);
  process.exit(1);
});

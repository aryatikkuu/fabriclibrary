#!/usr/bin/env node
/**
 * Re-read every fabric's label (blind) and tag what the fabric looks like.
 *
 * Usage:
 *   npm run verify-tag -- [--model gpt-5.4-mini] [--sample 20] [--status approved] [--budget 1]
 *   npm run verify-tag -- --save [--fix-codes] [--apply]
 *                                               write a finished report to the database (no API calls)
 *
 * One vision call per fabric, on its main photo at full resolution:
 *   - the label is read without showing the model the stored values, then
 *     compared field by field with the database (code, name, composition,
 *     GSM, width, colour) — disagreements are listed, never auto-applied;
 *   - visual tags (pattern, scale, colour, texture, finish, construction,
 *     technique) from the fixed list in lib/config/visual-tags.config.ts, plus
 *     a one-sentence searchable description — the input for image search.
 *
 * Results go to reports/verify-<model>.json (resumable: fabrics already in the
 * report are skipped). Spend is metered from the API's token counts and stops
 * at --budget USD (default 1).
 *
 * --save (dry run unless --apply) stores the report: visual tags into
 * fabric_tags as "<group>:<value>" (replacing earlier visual tags, keeping the
 * end-use tags), the description into fabrics.ai_description, and each label
 * re-read into ai_extraction_logs (shown to staff on the fabric page).
 *
 * --fix-codes acts on codes that disagree with the label reading:
 *   - fixed automatically: readings 1–2 characters off the stored code (a
 *     misread: 05013 -> 50313), and Orbit long SKUs that contain the stored
 *     quality number (D2325-2 -> PFTND2325W071400 — the chosen convention);
 *   - sent to review: completely different readings (often another label or
 *     field on the photo). The fabric goes back to needs_review and the review
 *     queue offers the reading as a one-click suggestion.
 * Skipped: blank-code records, readings with no digit (a name, not a code), and
 * codes another fabric of the mill already has (collisions — likely duplicates).
 * Every change is logged with its old value and written to
 * reports/code-changes.json. Other label fields are never changed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { adminClient, chunks, editDistance, flag, hasFlag, mapPool, selectAll } from './lib/common.mjs';
import { PRICES, askVision, cleanTags, loadPhoto } from './lib/vision.mjs';
import { visualTags } from '../lib/config/visual-tags.config.ts';
import { buildFabricVerifyPrompt } from '../features/ai-extraction/prompts/fabric-verify.prompt.ts';

const MODEL = flag('model', 'gpt-5.4-mini');
const SAMPLE = Number(flag('sample', 0));
const STATUS = flag('status', '');
const BUDGET = Number(flag('budget', 1));
if (!PRICES[MODEL]) throw new Error(`Unknown model ${MODEL}; add its price to PRICES`);

const db = adminClient();
const REPORT = `reports/verify-${MODEL}.json`;
const PROMPT = buildFabricVerifyPrompt(visualTags);

// ---------- comparison ----------

const alnum = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const numbers = (s) => (String(s ?? '').match(/\d+(\.\d+)?/g) ?? []).join(' ');
const firstInt = (s) => Number(String(s ?? '').match(/\d+/)?.[0]);

/**
 * How a stored value compares with what the label says:
 * match | contains (one holds the other, e.g. quality number inside an SKU) |
 * differs | label-unreadable | missing-in-db | both-empty.
 */
function compare(field, stored, read, label = {}) {
  const empty = (v) => v === null || v === undefined || String(v).trim() === '';
  if (empty(read)) return empty(stored) ? 'both-empty' : 'label-unreadable';
  if (empty(stored)) return 'missing-in-db';
  if (field === 'fabric_code') {
    const [a, b, q] = [alnum(stored), alnum(read), alnum(label.quality_number)];
    if (a === b || (q && a === q)) return 'match';
    return a.length >= 4 && (b.includes(a) || a.includes(b)) ? 'contains' : 'differs';
  }
  const same = {
    gsm: () => Number(stored) === firstInt(read),
    width: () => numbers(stored) === numbers(read),
    composition: () => numbers(stored) === numbers(read) && alnum(stored).replace(/\d/g, '').slice(0, 4) === alnum(read).replace(/\d/g, '').slice(0, 4),
  }[field] ?? (() => alnum(stored).includes(alnum(read)) || alnum(read).includes(alnum(stored)));
  return same() ? 'match' : 'differs';
}

// ---------- API ----------

async function analyse(fabric, image) {
  const jpeg = await loadPhoto(db, image.storage_path);
  const { cost, out, error } = await askVision({ model: MODEL, prompt: PROMPT, jpeg, maxTokens: 3000 });
  if (error) return { cost, error };
  const label = out.label ?? {};
  const checks = Object.fromEntries(
    ['fabric_code', 'fabric_name', 'composition', 'gsm', 'width', 'color'].map((f) => [f, compare(f, fabric[f], label[f], label)]),
  );
  const { kept, dropped } = cleanTags(out.tags);
  return {
    cost,
    result: {
      fabric_id: fabric.id,
      mill: fabric.mill?.slug,
      review_status: fabric.review_status,
      image: image.storage_path,
      stored: Object.fromEntries(Object.keys(checks).map((f) => [f, fabric[f]])),
      label,
      checks,
      label_count: out.label_count ?? null,
      label_readable: out.label_readable ?? null,
      multi_fabric: Boolean(out.multi_fabric),
      tags: kept,
      dropped_tags: dropped,
      description: String(out.description ?? '').slice(0, 300),
    },
  };
}

// ---------- selection ----------

/** Spread a sample evenly over mill x review status, deterministically. */
function sample(list, n) {
  const groups = new Map();
  for (const f of list) {
    const k = `${f.mill?.slug}|${f.review_status}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  const picked = [];
  const queues = [...groups.values()].map((g) => g.filter((_, i) => i % 97 === 0).concat(g.filter((_, i) => i % 97 !== 0)));
  for (let round = 0; picked.length < n && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && picked.length < n) picked.push(q[round]);
  }
  return picked;
}

async function main() {
  if (hasFlag('save')) {
    if (!existsSync(REPORT)) throw new Error(`No report at ${REPORT}`);
    return save(JSON.parse(readFileSync(REPORT, 'utf8')), hasFlag('apply'), hasFlag('fix-codes'));
  }
  const [fabrics, images, mills] = await Promise.all([
    selectAll(db, 'fabrics', 'id, mill_id, review_status, fabric_code, fabric_name, composition, gsm, width, color'),
    selectAll(db, 'fabric_images', 'id, fabric_id, storage_path, is_primary'),
    selectAll(db, 'mills', 'id, slug'),
  ]);
  const millById = new Map(mills.map((m) => [m.id, m]));
  const photoOf = new Map();
  for (const im of images) if (!photoOf.has(im.fabric_id) || im.is_primary) photoOf.set(im.fabric_id, im);

  mkdirSync('reports', { recursive: true });
  const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : { model: MODEL, spend_usd: 0, fabrics: {} };

  let todo = fabrics
    .map((f) => ({ ...f, mill: millById.get(f.mill_id) }))
    .filter((f) => photoOf.has(f.id) && !report.fabrics[f.id] && (!STATUS || f.review_status === STATUS));
  if (SAMPLE) todo = sample(todo, SAMPLE);
  console.log(`${MODEL}: ${todo.length} fabrics to check; spent so far $${report.spend_usd.toFixed(3)} (cap $${BUDGET})`);

  const CHUNK = 40;
  for (let start = 0; start < todo.length; start += CHUNK) {
    if (report.spend_usd >= BUDGET) {
      console.log(`BUDGET STOP at $${report.spend_usd.toFixed(3)}. ${todo.length - start} fabrics left — raise --budget to continue.`);
      break;
    }
    const chunk = todo.slice(start, start + CHUNK);
    const outcomes = await mapPool(chunk, 8, (f) => analyse(f, photoOf.get(f.id)));
    outcomes.forEach((o, i) => {
      report.spend_usd += o.cost ?? 0;
      if (o.result) report.fabrics[chunk[i].id] = o.result;
      else console.error(`  FAIL ${chunk[i].fabric_code}: ${o.error}`);
    });
    writeFileSync(REPORT, JSON.stringify(report, null, 1));
    console.log(`  ${Math.min(start + CHUNK, todo.length)}/${todo.length} — spent $${report.spend_usd.toFixed(3)}`);
  }

  summarise(report);
}

function summarise(report) {
  const rows = Object.values(report.fabrics);
  const byField = {};
  for (const r of rows) for (const [f, v] of Object.entries(r.checks)) (byField[f] ??= {})[v] = (byField[f][v] ?? 0) + 1;
  console.log(`\n${rows.length} fabrics checked, $${report.spend_usd.toFixed(3)} spent (${(report.spend_usd / rows.length || 0).toFixed(4)}/fabric)`);
  console.table(byField);
  const dropped = rows.reduce((n, r) => n + r.dropped_tags.length, 0);
  console.log(`off-list tags dropped: ${dropped}; multi-fabric photos: ${rows.filter((r) => r.multi_fabric).length}`);
  console.log(`Report: ${REPORT}`);
}

/**
 * What --fix-codes does with a fabric's code:
 * { fix: code } to replace it, { review: code } to send it to review with that
 * suggestion, or null to leave it (see the header for the rules).
 */
function codeDecision(r) {
  const read = String(r.label?.fabric_code ?? '').trim();
  const stored = String(r.stored.fabric_code ?? '').trim();
  if (!stored || !read || !/\d/.test(read) || read === stored) return null;
  const [a, b] = [alnum(stored), alnum(read)];
  const qualityNumber = a.match(/\d{4,}/)?.[0];
  if (r.mill === 'orbit-exports' && b.length > a.length && qualityNumber && b.includes(qualityNumber)) return { fix: read };
  if (r.checks.fabric_code !== 'differs') return null;
  return editDistance(a, b) <= 2 ? { fix: read } : { review: read };
}

/** Write a finished report to the database. Idempotent: re-running replaces the visual tags. */
async function save(report, apply, fixCodes) {
  const rows = Object.values(report.fabrics);
  const tagRows = rows.flatMap((r) =>
    Object.entries(r.tags).flatMap(([group, values]) => values.map((v) => ({ fabric_id: r.fabric_id, tag: `${group}:${v}` }))),
  );
  const described = rows.filter((r) => r.description);
  const decisions = fixCodes ? rows.map((r) => ({ r, ...codeDecision(r) })) : [];
  const fixes = decisions.filter((d) => d.fix).map((d) => ({ r: d.r, to: d.fix }));
  const toReview = decisions.filter((d) => d.review);
  console.log(`${rows.length} fabrics: ${tagRows.length} visual tags, ${described.length} descriptions, ${rows.length} log entries` +
    (fixCodes ? `, ${fixes.length} code corrections, ${toReview.length} codes to review` +
      ` (${toReview.filter((d) => d.r.review_status === 'approved').length} of them currently approved)` : ''));
  if (!apply) {
    console.log('Dry run — nothing written. Take a backup (npm run backup), then re-run with --save --apply.');
    return;
  }

  for (const ids of chunks(rows.map((r) => r.fabric_id), 200)) {
    const { error } = await db.from('fabric_tags').delete().in('fabric_id', ids).like('tag', '%:%');
    if (error) throw new Error(`clear visual tags: ${error.message}`);
  }
  for (const batch of chunks(tagRows, 500)) {
    const { error } = await db.from('fabric_tags').upsert(batch, { onConflict: 'fabric_id,tag', ignoreDuplicates: true });
    if (error) throw new Error(`tags: ${error.message}`);
  }
  const updates = await mapPool(described, 8, async (r) => {
    const { error } = await db.from('fabrics').update({ ai_description: r.description }).eq('id', r.fabric_id);
    if (error) throw new Error(`description ${r.fabric_id}: ${error.message}`);
  });
  // Code corrections first, so each log entry can record whether its change landed.
  const changes = [];
  const collisions = [];
  for (const { r, to } of fixes) {
    const { error } = await db.from('fabrics').update({ fabric_code: to }).eq('id', r.fabric_id);
    if (!error) changes.push({ fabric_id: r.fabric_id, mill: r.mill, from: r.stored.fabric_code, to });
    else if (error.code === '23505') collisions.push({ fabric_id: r.fabric_id, mill: r.mill, from: r.stored.fabric_code, to });
    else throw new Error(`code ${r.stored.fabric_code} -> ${to}: ${error.message}`);
  }
  const reviewIds = toReview.map((d) => d.r.fabric_id);
  for (const ids of chunks(reviewIds, 200)) {
    const { error } = await db.from('fabrics').update({ review_status: 'needs_review' }).in('id', ids).eq('review_status', 'approved');
    if (error) throw new Error(`send to review: ${error.message}`);
  }
  if (fixCodes) {
    const review = toReview.map((d) => ({ fabric_id: d.r.fabric_id, mill: d.r.mill, stored: d.r.stored.fabric_code, label: d.review }));
    writeFileSync('reports/code-changes.json', JSON.stringify({ changes, collisions, review }, null, 1));
  }
  const changed = new Map(changes.map((c) => [c.fabric_id, c]));
  const suggested = new Map(toReview.map((d) => [d.r.fabric_id, d.review]));

  const logs = rows.map((r) => ({
    fabric_id: r.fabric_id,
    source_image_path: r.image,
    extracted_json: {
      kind: 'label-verify', model: report.model, label: r.label, checks: r.checks,
      label_count: r.label_count, multi_fabric: r.multi_fabric,
      ...(changed.has(r.fabric_id) && { code_change: { from: changed.get(r.fabric_id).from, to: changed.get(r.fabric_id).to } }),
      ...(suggested.has(r.fabric_id) && { code_suggestion: suggested.get(r.fabric_id) }),
    },
    extraction_status: 'success',
  }));
  // Replace earlier label-verify logs, so re-running --save never duplicates them.
  for (const ids of chunks(rows.map((r) => r.fabric_id), 200)) {
    const { error } = await db.from('ai_extraction_logs').delete().in('fabric_id', ids).eq('extracted_json->>kind', 'label-verify');
    if (error) throw new Error(`clear logs: ${error.message}`);
  }
  for (const batch of chunks(logs, 500)) {
    const { error } = await db.from('ai_extraction_logs').insert(batch);
    if (error) throw new Error(`logs: ${error.message}`);
  }
  const failed = updates.filter((u) => u?.error);
  failed.slice(0, 5).forEach((u) => console.error('  FAIL', u.error));
  console.log(`Saved: ${tagRows.length} tags, ${described.length - failed.length} descriptions, ${logs.length} log entries.`);
  if (fixCodes) console.log(`Codes: ${changes.length} corrected, ${collisions.length} skipped (already used by another fabric), ` +
    `${reviewIds.length} sent to review — see reports/code-changes.json`);
}

main().catch((e) => {
  console.error('verify-and-tag FAILED:', e.message);
  process.exit(1);
});

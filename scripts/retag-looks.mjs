/**
 * Re-tag what fabrics look like (visual tags only — labels, codes and
 * descriptions are left alone). Used after the vocabulary grows, e.g. the
 * "detail" group (gingham, pinstripe, herringbone …).
 *
 *   npm run retag -- [--select affected|patterned] [--report reports/x.json] [--sample 20] [--budget 1]
 *   npm run retag -- --save [--groups detail|none] [--fix-plain] [--apply]
 *
 * --save writes only the listed groups (default: detail) and leaves the
 * fabric's other tags alone. Re-tagging every group was tested and rejected:
 * the model re-describes colours differently run to run, which made search
 * worse for plain fabrics (reports/retag-benchmark.md).
 *
 * --select chooses what is re-tagged: "affected" (default: checks, stripes,
 * geometrics, dots, textured solids and swatch cards), "patterned" (every
 * fabric with a pattern, plus plain-tagged ones that look patterned: metallic
 * yarn, jacquard/dobby in the text or tags); --all does every fabric.
 *
 * --fix-plain also corrects fabrics tagged plain (solid / textured-solid) that
 * the re-read sees as patterned — dark photos hide jacquards. For those it
 * replaces pattern, scale, technique, finish and detail; colours are kept.
 * Photos are shrunk to 1024 px, like the photo-search upload, so a buyer's
 * photo and the library are seen the same way.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { adminClient, chunks, flag, hasFlag, mapPool, selectAll } from './lib/common.mjs';
import { askVision, cleanTags, loadPhoto } from './lib/vision.mjs';
import { visualTags } from '../lib/config/visual-tags.config.ts';
import { buildRetagPrompt } from '../features/ai-extraction/prompts/fabric-tags.prompt.ts';

const MODEL = 'gpt-5.4-mini'; // must match LOOK_MODEL in features/look-search/read-look.ts
const SAMPLE = Number(flag('sample', 0));
const BUDGET = Number(flag('budget', 1));
const REPORT = flag('report', 'reports/retag-looks.json');
const SELECT = flag('select', 'affected');
const PLAIN = ['pattern:solid', 'pattern:textured-solid'];
const FIX_GROUPS = ['pattern', 'scale', 'technique', 'finish', 'detail'];
const AFFECTED = ['pattern:check', 'pattern:stripe', 'pattern:geometric', 'pattern:dot', 'pattern:textured-solid'];

const db = adminClient();
const PROMPT = buildRetagPrompt(visualTags);

function groupTags(rows) {
  const by = new Map();
  for (const { fabric_id, tag } of rows) (by.get(fabric_id) ?? by.set(fabric_id, []).get(fabric_id)).push(tag);
  return by;
}

const allTags = (groups) => groups.flatMap((g) => visualTags[g].map((v) => `${g}:${v}`));

async function tag(image) {
  const jpeg = await loadPhoto(db, image.storage_path, { maxSide: 1024, quality: 85 });
  const { cost, out, error } = await askVision({ model: MODEL, prompt: PROMPT, jpeg, maxTokens: 1500 });
  return error ? { cost, error } : { cost, tags: cleanTags(out.tags).kept, multi_fabric: Boolean(out.multi_fabric) };
}

async function main() {
  if (!existsSync('reports')) mkdirSync('reports');
  const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : { model: MODEL, spend_usd: 0, fabrics: {} };
  if (hasFlag('save')) return save(report, hasFlag('apply'));

  const [fabrics, images, tags, verify] = await Promise.all([
    selectAll(db, 'fabrics', 'id, fabric_code, fabric_name, fabric_type, composition, ai_description, description'),
    selectAll(db, 'fabric_images', 'id, fabric_id, storage_path, is_primary'),
    selectAll(db, 'fabric_tags', 'fabric_id, tag', 'fabric_id'),
    existsSync('reports/verify-gpt-5.4-mini.json') ? JSON.parse(readFileSync('reports/verify-gpt-5.4-mini.json', 'utf8')).fabrics : {},
  ]);
  const photoOf = new Map();
  for (const im of images) if (!photoOf.has(im.fabric_id) || im.is_primary) photoOf.set(im.fabric_id, im);
  const affected = new Set();
  if (SELECT === 'patterned') {
    const tagsOf = groupTags(tags);
    for (const f of fabrics) {
      const own = tagsOf.get(f.id) ?? [];
      const patterns = own.filter((t) => t.startsWith('pattern:'));
      const looksPatterned = /\bMET\b|metal|lurex/i.test(f.composition ?? '') ||
        /jacquard|dobby|brocade/i.test(`${f.fabric_name} ${f.fabric_type} ${f.ai_description} ${f.description}`) ||
        own.some((t) => ['technique:jacquard', 'technique:dobby', 'finish:metallic', 'finish:sheen'].includes(t));
      if (patterns.some((t) => !PLAIN.includes(t) && t !== 'pattern:melange') || (patterns.every((t) => PLAIN.includes(t)) && looksPatterned)) affected.add(f.id);
    }
  } else {
    for (const t of tags) if (AFFECTED.includes(t.tag)) affected.add(t.fabric_id);
    for (const [id, v] of Object.entries(verify)) if (v.multi_fabric) affected.add(id);
  }

  let todo = fabrics.filter((f) => photoOf.has(f.id) && !report.fabrics[f.id] && (hasFlag('all') || affected.has(f.id)));
  if (SAMPLE) todo = todo.filter((_, i) => i % Math.max(1, Math.floor(todo.length / SAMPLE)) === 0).slice(0, SAMPLE);
  console.log(`${todo.length} fabrics to re-tag; spent so far $${report.spend_usd.toFixed(3)} (cap $${BUDGET})`);

  const CHUNK = 40;
  for (let start = 0; start < todo.length; start += CHUNK) {
    if (report.spend_usd >= BUDGET) {
      console.log(`BUDGET STOP at $${report.spend_usd.toFixed(3)}. ${todo.length - start} left — raise --budget to continue.`);
      break;
    }
    const chunk = todo.slice(start, start + CHUNK);
    const outcomes = await mapPool(chunk, 8, (f) => tag(photoOf.get(f.id)).catch((e) => ({ error: e.message })));
    outcomes.forEach((o, i) => {
      report.spend_usd += o.cost ?? 0;
      if (o.tags) report.fabrics[chunk[i].id] = { fabric_id: chunk[i].id, image: photoOf.get(chunk[i].id).storage_path, tags: o.tags, multi_fabric: o.multi_fabric };
      else console.error(`  FAIL ${chunk[i].fabric_code}: ${o.error}`);
    });
    writeFileSync(REPORT, JSON.stringify(report, null, 1));
    console.log(`  ${Math.min(start + CHUNK, todo.length)}/${todo.length} — spent $${report.spend_usd.toFixed(3)}`);
  }
  const rows = Object.values(report.fabrics);
  console.log(`\n${rows.length} re-tagged, $${report.spend_usd.toFixed(3)} (${(report.spend_usd / rows.length || 0).toFixed(5)}/fabric); ` +
    `${rows.filter((r) => r.tags.detail.length).length} with a detail tag, ` +
    `${rows.filter((r) => r.multi_fabric).length} swatch cards`);
}

/** Replace the re-tagged fabrics' tags in the chosen groups; all other tags are kept. */
async function save(report, apply) {
  const groups = flag('groups', 'detail') === 'none' ? [] : String(flag('groups', 'detail')).split(',');
  if (groups.some((g) => !(g in visualTags))) throw new Error(`Unknown group in --groups ${groups}`);
  const rows = Object.values(report.fabrics);
  const toRows = (r, gs) => gs.flatMap((group) => (r.tags[group] ?? []).map((v) => ({ fabric_id: r.fabric_id, tag: `${group}:${v}` })));
  const tagRows = rows.flatMap((r) => toRows(r, groups));
  console.log(`${rows.length} fabrics: ${tagRows.length} tags in ${groups.join(', ')}`);

  // Plain-tagged fabrics the re-read sees as patterned.
  let fixes = [];
  if (hasFlag('fix-plain')) {
    const tagsOf = groupTags(await selectAll(db, 'fabric_tags', 'fabric_id, tag', 'fabric_id'));
    fixes = rows.filter((r) => {
      const patterns = (tagsOf.get(r.fabric_id) ?? []).filter((t) => t.startsWith('pattern:'));
      return patterns.length && patterns.every((t) => PLAIN.includes(t)) &&
        r.tags.pattern.some((p) => !PLAIN.includes(`pattern:${p}`) && p !== 'melange');
    });
    writeFileSync(REPORT.replace(/\.json$/, '-plain-fixes.json'), JSON.stringify(fixes.map((r) => ({
      fabric_id: r.fabric_id, image: r.image, before: (tagsOf.get(r.fabric_id) ?? []).filter((t) => FIX_GROUPS.includes(t.split(':')[0])),
      after: toRows(r, FIX_GROUPS).map((t) => t.tag) })), null, 1));
    console.log(`${fixes.length} plain-tagged fabrics re-read as patterned (listed in ${REPORT.replace(/\.json$/, '-plain-fixes.json')})`);
  }
  if (!apply) return console.log('Dry run — nothing written. Take a backup (npm run backup), then re-run with --save --apply.');

  for (const ids of chunks(fixes.map((r) => r.fabric_id), 200)) {
    const { error } = await db.from('fabric_tags').delete().in('fabric_id', ids).in('tag', allTags(FIX_GROUPS));
    if (error) throw new Error(`clear plain tags: ${error.message}`);
  }
  const fixRows = fixes.flatMap((r) => toRows(r, FIX_GROUPS.filter((g) => !groups.includes(g))));
  for (const batch of chunks(fixRows, 500)) {
    const { error } = await db.from('fabric_tags').upsert(batch, { onConflict: 'fabric_id,tag', ignoreDuplicates: true });
    if (error) throw new Error(`plain fixes: ${error.message}`);
  }

  for (const ids of chunks(rows.map((r) => r.fabric_id), 200)) {
    const { error } = await db.from('fabric_tags').delete().in('fabric_id', ids).in('tag', allTags(groups));
    if (error) throw new Error(`clear tags: ${error.message}`);
  }
  for (const batch of chunks(tagRows, 500)) {
    const { error } = await db.from('fabric_tags').upsert(batch, { onConflict: 'fabric_id,tag', ignoreDuplicates: true });
    if (error) throw new Error(`tags: ${error.message}`);
  }
  console.log(`Saved ${tagRows.length} tags${fixes.length ? ` and fixed ${fixes.length} plain-tagged fabrics` : ''}.`);
}

main().catch((e) => {
  console.error('retag-looks FAILED:', e.message);
  process.exit(1);
});

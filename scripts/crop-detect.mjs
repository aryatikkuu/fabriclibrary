#!/usr/bin/env node
/**
 * Find the fabric in every hanger photo so we can crop away hangers, labels and
 * background (for clean catalogue images and, later, visual search).
 *
 * The model only returns box coordinates (0-1000, relative to the image), which
 * are applied to the full-resolution original later — the downscaled copy sent
 * to the API is never stored.
 *
 * Usage (from the repo root):
 *   npm run crop-detect -- pass1    every unique photo, downscaled to 512px (cheap)
 *   npm run crop-detect -- pass2    re-run multi-fabric photos at full resolution,
 *                                         also reading each fabric's label code
 *   npm run crop-detect -- status   progress + spend so far
 *
 * Spend is metered from the API's reported token usage and capped by
 * CROP_BUDGET_USD (default 20) across both passes: a pass stops before a chunk
 * that could cross the cap, and pass2 refuses to start if its projected cost
 * would. Results live in .crop-boxes.json (resumable; copied by backup.mjs) —
 * that file is the paid-for output, everything downstream is rebuilt from it.
 * Pilot, model comparison and costs: docs/VISUAL_SEARCH_PLAN.md.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { loadEnv, isImageFile, mapPool } from './lib/common.mjs';

loadEnv();

const LIBRARY = process.env.HANGER_LIBRARY_DIR ?? '/Users/aryatikku/Desktop/LIBRARY (HANGERS)';
const FOLDERS = {
  'MASOOD HANGERS': 'masood-textile-mills',
  'BANSWARA HANGERS': 'banswara-syntex',
  'ORBIT HANGERS': 'orbit-exports',
  'ORBIT HANGERS-(NEW)': 'orbit-exports',
};
const MODEL = 'gpt-5.4';
const PRICE_PER_M = { input: 2.5, output: 15 }; // USD per 1M tokens, gpt-5.4 standard
const BUDGET_USD = Number(process.env.CROP_BUDGET_USD ?? 20);
const PASS2_EST_PER_PHOTO = 0.006; // measured in the pilot at full resolution
const CONCURRENCY = 8;
const CHUNK = 40;
const STATE_PATH = resolve(process.cwd(), '.crop-boxes.json');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local');
  process.exit(1);
}

const BASE_PROMPT = `This photo shows fabric samples on a hanger / swatch card, sometimes with a desk or other objects around it.
Find every distinct piece of FABRIC. Exclude the cardboard hanger header, printed labels, stickers, hooks, the desk/background and any unrelated clothing.
Labels, stickers and QR tags are sometimes stuck ON the fabric: for each fabric box the largest rectangle of plain fabric that does NOT contain any label or sticker.
Box only visible fabric surface - the box must contain no hanger, label or background. Prefer a slightly smaller box that is 100% fabric over a larger one that includes non-fabric.
Coordinates are integers 0-1000, normalised to image width (x) and height (y).
List the main large swatch first. For rows of small colourway strips, return ONE box per row (kind "colourway_strip") and put the number of strips in colourway_strip_count.
label_count is the number of separate printed labels / stickers / tags visible anywhere in the photo.`;

const PASS1_PROMPT = `${BASE_PROMPT}
Return JSON only:
{"fabrics":[{"box":[x0,y0,x1,y1],"kind":"main"|"colourway_strip"|"other","colour":"short colour name"}],
 "colourway_strip_count": 0, "label_count": 0, "notes": ""}`;

const PASS2_PROMPT = `${BASE_PROMPT}
For each fabric also give label_code: the fabric/quality code printed on the label that belongs to that fabric ("" if none is readable).
Return JSON only:
{"fabrics":[{"box":[x0,y0,x1,y1],"kind":"main"|"colourway_strip"|"other","colour":"short colour name","label_code":""}],
 "colourway_strip_count": 0, "label_count": 0, "notes": ""}`;

// ---------- state ----------

function loadState() {
  if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  return { model: MODEL, spend_usd: 0, photos: {} };
}
function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 1));
}

/** Every photo in the library, keyed "<folder>/<file>"; byte-identical copies point at the first one. */
function inventory(state) {
  const seen = new Map(Object.entries(state.photos).filter(([, p]) => !p.dup_of).map(([k, p]) => [p.hash, k]));
  for (const [folder, mill] of Object.entries(FOLDERS)) {
    for (const file of readdirSync(join(LIBRARY, folder)).sort()) {
      if (!isImageFile(file)) continue;
      const key = `${folder}/${file}`;
      if (state.photos[key]) continue;
      const hash = createHash('md5').update(readFileSync(join(LIBRARY, key))).digest('hex');
      const original = seen.get(hash);
      state.photos[key] = original ? { mill, hash, dup_of: original } : { mill, hash };
      if (!original) seen.set(hash, key);
    }
  }
}

// ---------- API ----------

async function imageDataUrl(path, maxPx) {
  const buf = maxPx
    ? await sharp(path).rotate().resize(maxPx, maxPx, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer()
    : await sharp(path).rotate().jpeg({ quality: 90 }).toBuffer(); // .rotate() applies EXIF so boxes match what we crop
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

const clamp = (n) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));

function cleanFabrics(fabrics) {
  return (Array.isArray(fabrics) ? fabrics : [])
    .map((f) => {
      const [x0, y0, x1, y1] = (f.box ?? []).map(clamp);
      return { ...f, box: [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)] };
    })
    .filter((f) => f.box[2] - f.box[0] >= 20 && f.box[3] - f.box[1] >= 20); // drop slivers (<2% of the frame)
}

async function detect(path, pass) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: pass === 1 ? PASS1_PROMPT : PASS2_PROMPT },
            { type: 'image_url', image_url: { url: await imageDataUrl(path, pass === 1 ? 512 : 0), detail: 'high' } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = await res.json();
  const usage = data.usage ?? {};
  const cost = ((usage.prompt_tokens ?? 0) * PRICE_PER_M.input + (usage.completion_tokens ?? 0) * PRICE_PER_M.output) / 1e6;
  let parsed;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '');
  } catch {
    return { cost, error: 'unparseable response' }; // still paid for — count it
  }
  const fabrics = cleanFabrics(parsed.fabrics);
  return {
    cost,
    result: {
      fabrics,
      colourway_strip_count: Number(parsed.colourway_strip_count) || 0,
      label_count: Number(parsed.label_count) || 0,
      notes: String(parsed.notes ?? '').slice(0, 300),
    },
  };
}

/** Needs the full-resolution pass: several fabrics or several labels. */
const isMulti = (r) => r && (r.fabrics.length > 1 || r.label_count > 1);

// ---------- passes ----------

async function runPass(state, pass, keys) {
  const field = `pass${pass}`;
  const todo = keys.filter((k) => !state.photos[k][field]);
  const estPerPhoto = pass === 1 ? 0.0025 : PASS2_EST_PER_PHOTO;
  console.log(`pass${pass}: ${todo.length} to do, spent so far $${state.spend_usd.toFixed(2)} of $${BUDGET_USD} cap`);

  for (let start = 0; start < todo.length; start += CHUNK) {
    const chunk = todo.slice(start, start + CHUNK);
    if (state.spend_usd + chunk.length * estPerPhoto > BUDGET_USD) {
      console.log(`BUDGET STOP: next chunk could take spend past $${BUDGET_USD} (spent $${state.spend_usd.toFixed(2)}). ` +
        `${todo.length - start} photos left in pass${pass}. Raise CROP_BUDGET_USD to continue.`);
      return false;
    }
    const t0 = Date.now();
    const outcomes = await mapPool(chunk, CONCURRENCY, (key) => detect(join(LIBRARY, key), pass));
    let failed = 0;
    outcomes.forEach((o, n) => {
      state.spend_usd += o.cost ?? 0; // unparseable replies are still billed
      if (o.result) state.photos[chunk[n]][field] = o.result;
      else { failed++; console.error(`  FAIL ${chunk[n]}: ${o.error}`); }
    });
    saveState(state);
    console.log(`[pass${pass}] ${Math.min(start + CHUNK, todo.length)}/${todo.length} ` +
      `(${((Date.now() - t0) / 1000).toFixed(0)}s, ${failed} failed → retried next run) spent $${state.spend_usd.toFixed(2)}`);
  }
  return true;
}

function summary(state) {
  const all = Object.values(state.photos);
  const uniq = Object.entries(state.photos).filter(([, p]) => !p.dup_of);
  const byMill = {};
  for (const [, p] of uniq) {
    const m = (byMill[p.mill] ??= { photos: 0, pass1: 0, multi: 0, pass2: 0 });
    m.photos++;
    if (p.pass1) m.pass1++;
    if (isMulti(p.pass1)) m.multi++;
    if (p.pass2) m.pass2++;
  }
  console.log(`${all.length} files, ${uniq.length} unique, ${all.length - uniq.length} duplicates skipped`);
  console.table(byMill);
  console.log(`spent $${state.spend_usd.toFixed(2)} of $${BUDGET_USD} cap`);
}

async function main() {
  const cmd = process.argv[2];
  const state = loadState();
  inventory(state);
  saveState(state);
  const unique = Object.keys(state.photos).filter((k) => !state.photos[k].dup_of);

  if (cmd === 'pass1') {
    await runPass(state, 1, unique);
  } else if (cmd === 'pass2') {
    const unfinished = unique.filter((k) => !state.photos[k].pass1).length;
    if (unfinished) {
      console.log(`pass1 still has ${unfinished} photos to finish first.`);
      return summary(state);
    }
    const multi = unique.filter((k) => isMulti(state.photos[k].pass1) && !state.photos[k].pass2);
    const projected = state.spend_usd + multi.length * PASS2_EST_PER_PHOTO;
    console.log(`pass2 would re-run ${multi.length} multi-fabric photos: projected total $${projected.toFixed(2)}`);
    if (projected > BUDGET_USD) {
      console.log(`NOT STARTED: projected total exceeds the $${BUDGET_USD} cap. Raise CROP_BUDGET_USD to proceed.`);
      return summary(state);
    }
    await runPass(state, 2, multi);
  } else if (cmd !== 'status') {
    console.error('Usage: npm run crop-detect -- pass1 | pass2 | status');
    process.exit(1);
  }
  summary(state);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

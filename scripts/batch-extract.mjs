#!/usr/bin/env node
/**
 * Cheap, non-Claude batch extraction: walks a folder of hanger photos,
 * calls the SAME OpenAI Vision pipeline the app uses (gpt-5.4-nano, see
 * features/ai-extraction/extraction.service.ts + prompts/fabric-extraction.prompt.ts)
 * directly over the OpenAI API, validates the result, and bulk-inserts via
 * scripts/bulk-insert.mjs. Fully resumable via the same
 * .extraction-progress-<mill>.json files the manual Claude-agent runs used.
 *
 * Usage: npm run extract -- <mill_slug> "<absolute photo folder>" [concurrency]
 * Example:
 *   npm run extract -- masood-textile-mills "/Users/aryatikku/Desktop/LIBRARY (HANGERS)/MASOOD HANGERS" 8
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnv, isImageFile, contentTypeFor, mapPool } from './lib/common.mjs';
import { millsConfig } from '../lib/config/mills.config.ts';
import {
  FABRIC_EXTRACTION_SYSTEM_PROMPT,
  FABRIC_EXTRACTION_USER_PROMPT,
} from '../features/ai-extraction/prompts/fabric-extraction.prompt.ts';

loadEnv();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local');
  process.exit(1);
}

const [, , millSlug, folder, concurrencyArg] = process.argv;
if (!millSlug || !folder) {
  console.error('Usage: npm run extract -- <mill_slug> "<photo folder>" [concurrency]');
  process.exit(1);
}
const CONCURRENCY = Number(concurrencyArg) || 8;
const millKey = millSlug.split('-')[0]; // e.g. "masood-textile-mills" -> "masood"
const progressPath = resolve(process.cwd(), `.extraction-progress-${millKey}.json`);


// The app's own prompt (features/ai-extraction/) — one copy, so the batch run
// and in-app uploads always extract identically.
const USER_PROMPT = FABRIC_EXTRACTION_USER_PROMPT.replace('{{MILL_NAMES}}', millsConfig.map((m) => m.name).join(', '));

/**
 * Occasionally the model degenerates into a runaway string on an unreadable
 * label and fills the whole token budget, so the JSON comes back truncated and
 * unparseable. Raising the budget does not help — it just moves the cut. The
 * second attempt caps field lengths, which reliably breaks the loop.
 */
async function extractOne(imagePath, attempt = 0) {
  const b64 = readFileSync(imagePath).toString('base64');
  const dataUrl = `data:${contentTypeFor(imagePath)};base64,${b64}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-5.4-nano',
      max_completion_tokens: 4000,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: FABRIC_EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                attempt === 0
                  ? USER_PROMPT
                  : USER_PROMPT +
                    '\nKeep every string field under 120 characters. Never repeat a token sequence. ' +
                    'If the label is unreadable, return the empty shape with a low confidence_score.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '';

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (err) {
    if (attempt === 0) return extractOne(imagePath, 1);
    throw err;
  }

  const gsmRaw = parsed.gsm;
  const gsm =
    gsmRaw === null || gsmRaw === '' || gsmRaw === undefined
      ? null
      : (() => {
          const n = typeof gsmRaw === 'string' ? parseInt(gsmRaw.replace(/[^\d]/g, ''), 10) : gsmRaw;
          return Number.isFinite(n) && n > 0 && n <= 2000 ? Math.round(n) : null;
        })();

  return {
    mill_slug: millSlug,
    fabric_code: parsed.fabric_code || '',
    fabric_name: parsed.fabric_name || '',
    fabric_type: parsed.fabric_type || '',
    composition: parsed.composition || '',
    gsm,
    width: parsed.width || '',
    color: parsed.color || '',
    color_family: parsed.color_family || '',
    season: parsed.season || '',
    suggested_use: parsed.suggested_use || '',
    use_tags: Array.isArray(parsed.use_tags) ? parsed.use_tags : [],
    description: parsed.technical_notes || '',
    image_path: imagePath,
    extraction_confidence: Number(parsed.confidence_score) || 0,
    review_status: 'needs_review',
  };
}

function loadProgress() {
  if (existsSync(progressPath)) return JSON.parse(readFileSync(progressPath, 'utf8'));
  return { processed: [], insertedCount: 0, failedCount: 0 };
}
function saveProgress(p) {
  writeFileSync(progressPath, JSON.stringify(p, null, 2));
}

async function main() {
  const progress = loadProgress();
  const processedSet = new Set(progress.processed);
  const allFiles = readdirSync(folder).filter(isImageFile);
  const todo = allFiles.filter((f) => !processedSet.has(f));

  console.log(`${millSlug}: ${allFiles.length} total, ${processedSet.size} already done, ${todo.length} to go. Concurrency=${CONCURRENCY}`);

  const CHUNK = 40; // extract + insert in chunks so progress is saved incrementally
  for (let start = 0; start < todo.length; start += CHUNK) {
    const chunk = todo.slice(start, start + CHUNK);
    const paths = chunk.map((f) => join(folder, f));

    const t0 = Date.now();
    const results = await mapPool(paths, CONCURRENCY, (p) => extractOne(p));
    const ok = [];
    const okFiles = [];
    let failed = 0;
    results.forEach((r, idx) => {
      if (r && !r.error) {
        ok.push(r);
        okFiles.push(chunk[idx]);
      } else {
        failed++;
        console.error(`  extract FAIL ${chunk[idx]}: ${r?.error}`);
      }
    });

    if (ok.length) {
      const batchPath = resolve(process.cwd(), `.tmp-batch-${millKey}-${start}.json`);
      writeFileSync(batchPath, JSON.stringify(ok, null, 2));
      try {
        const out = execFileSync(process.execPath, [...process.execArgv, 'scripts/bulk-insert.mjs', batchPath], { encoding: 'utf8', cwd: process.cwd() });
        process.stdout.write(out);
      } catch (e) {
        console.error('bulk-insert.mjs failed for this chunk:', e.message);
      } finally {
        try { unlinkSync(batchPath); } catch {}
      }
    }

    // Only mark successfully-extracted files as processed; failed ones are
    // left out of "processed" so a future run retries them automatically.
    progress.processed.push(...okFiles);
    progress.insertedCount = (progress.insertedCount || 0) + ok.length;
    progress.failedCount = (progress.failedCount || 0) + failed;
    saveProgress(progress);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[${millSlug}] ${progress.processed.length}/${allFiles.length} done (chunk of ${chunk.length} in ${elapsed}s, ${failed} failed, will retry)`);
  }

  console.log(`Done. ${progress.processed.length}/${allFiles.length} processed. inserted=${progress.insertedCount} failed=${progress.failedCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

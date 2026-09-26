/**
 * Shared pieces of the AI tagging scripts (verify-and-tag.mjs, retag-looks.mjs):
 * token prices, loading a fabric photo, one vision call, and keeping only
 * tags from the fixed vocabulary. Needs --experimental-strip-types (npm scripts).
 */

import sharp from 'sharp';
import { STORAGE_BUCKET } from './common.mjs';
import { visualTags } from '../../lib/config/visual-tags.config.ts';

/** USD per 1M tokens (input, output) — standard tier. */
export const PRICES = { 'gpt-5.4': [2.5, 15], 'gpt-5.4-mini': [0.75, 4.5], 'gpt-5.4-nano': [0.2, 1.25] };

/**
 * A fabric photo from Storage as upright JPEG. `maxSide` shrinks it (1024 is
 * what photo search sends, so library and buyer photos are seen alike).
 */
export async function loadPhoto(db, storagePath, { maxSide, quality = 90 } = {}) {
  const { data, error } = await db.storage.from(STORAGE_BUCKET()).download(storagePath);
  if (error) throw new Error(`download ${storagePath}: ${error.message}`);
  let image = sharp(Buffer.from(await data.arrayBuffer())).rotate();
  if (maxSide) image = image.resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true });
  return image.jpeg({ quality }).toBuffer();
}

/**
 * One JSON-mode vision call: prompt + JPEG → { cost, out } (parsed JSON), or
 * { cost, error } when the reply isn't JSON. Throws on HTTP errors.
 */
export async function askVision({ model, prompt, jpeg, maxTokens }) {
  if (!PRICES[model]) throw new Error(`Unknown model ${model}; add its price to PRICES`);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}`, detail: 'high' } },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const [pin, pout] = PRICES[model];
  const cost = ((body.usage?.prompt_tokens ?? 0) * pin + (body.usage?.completion_tokens ?? 0) * pout) / 1e6;
  try {
    return { cost, out: JSON.parse(body.choices?.[0]?.message?.content ?? '') };
  } catch {
    return { cost, error: 'unparseable response' };
  }
}

/** Keep only vocabulary words (deduplicated); report anything the model invented. */
export function cleanTags(tags) {
  const kept = {};
  const dropped = [];
  for (const [group, allowed] of Object.entries(visualTags)) {
    const values = Array.isArray(tags?.[group]) ? tags[group] : [];
    kept[group] = [...new Set(values.filter((v) => allowed.includes(v)))];
    dropped.push(...values.filter((v) => !allowed.includes(v)).map((v) => `${group}:${v}`));
  }
  return { kept, dropped };
}

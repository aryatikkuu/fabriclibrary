#!/usr/bin/env node
/**
 * Bulk-insert fabrics extracted manually (no OpenAI call) from hanger photos.
 *
 * Usage: node scripts/bulk-insert.mjs <batch.json>
 *
 * batch.json is an array of:
 *   {
 *     mill_slug, fabric_code, fabric_name, fabric_type, composition,
 *     gsm, width, color, color_family, season, suggested_use, use_tags, description,
 *     image_path (absolute path to the source photo on disk),
 *     extraction_confidence, review_status
 *   }
 *
 * Upserts fabrics on (mill_id, fabric_code), uploads the source photo to
 * Storage, and attaches it as the primary image.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.STORAGE_BUCKET_NAME ?? 'textile-library';

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const batchPath = process.argv[2];
if (!batchPath) {
  console.error('Usage: node scripts/bulk-insert.mjs <batch.json>');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function sanitize(segment) {
  return segment
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

const mimeFromExt = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
};

const tmpDir = mkdtempSync(join(tmpdir(), 'fabric-orient-'));

function getDims(path) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], {
    encoding: 'utf8',
  });
  return {
    width: Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]),
    height: Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]),
  };
}

/** There is no reliable heuristic for these source photos — neither raw
 * dimensions nor a fixed angle predicts the fix (verified: different photos
 * in the same folder need -90, 180, or no rotation at all). Every record
 * must carry an explicit `rotate` value (0/90/180/270, clockwise) determined
 * by actually viewing that photo. Records without one are left untouched
 * rather than guessed. */
function correctOrientation(srcPath, degrees) {
  if (!degrees) return srcPath;
  try {
    const outPath = join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.jpeg`);
    execFileSync('sips', ['-r', String(degrees), srcPath, '--out', outPath], { stdio: 'ignore' });
    return outPath;
  } catch {
    return srcPath;
  }
}

/** Optional per-record crop, as fractions (0-1) of the oriented image:
 * { x, y, w, h }. Lets multi-colorway range-card photos yield a distinct
 * swatch image per fabric record. */
function applyCrop(srcPath, crop) {
  if (!crop) return srcPath;
  try {
    const { width, height } = getDims(srcPath);
    if (!width || !height) return srcPath;
    const px = Math.round(crop.x * width);
    const py = Math.round(crop.y * height);
    const pw = Math.max(1, Math.round(crop.w * width));
    const ph = Math.max(1, Math.round(crop.h * height));
    const outPath = join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}-crop.jpeg`);
    execFileSync(
      'sips',
      ['--cropOffset', String(py), String(px), '-c', String(ph), String(pw), srcPath, '--out', outPath],
      { stdio: 'ignore' },
    );
    return outPath;
  } catch {
    return srcPath;
  }
}

async function main() {
  const records = JSON.parse(readFileSync(resolve(batchPath), 'utf8'));

  const millCache = new Map();
  async function resolveMill(slug) {
    if (millCache.has(slug)) return millCache.get(slug);
    const { data, error } = await db.from('mills').select('id, slug').eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Mill not found: ${slug}`);
    millCache.set(slug, data.id);
    return data.id;
  }

  let ok = 0;
  let failed = 0;

  for (const r of records) {
    try {
      const millId = await resolveMill(r.mill_slug);
      const filename = r.image_path.split('/').pop();
      const storagePath = `mills/${r.mill_slug}/fabrics/${sanitize(r.fabric_code)}/images/${sanitize(filename)}`;
      const correctedPath = applyCrop(correctOrientation(r.image_path, r.rotate), r.crop);
      const buffer = readFileSync(correctedPath);

      const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(storagePath, buffer, { contentType: mimeFromExt(filename), upsert: true });
      if (uploadError) throw uploadError;
      const publicUrl = db.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;

      const { data: existing, error: findError } = await db
        .from('fabrics')
        .select('id')
        .eq('mill_id', millId)
        .eq('fabric_code', r.fabric_code)
        .maybeSingle();
      if (findError) throw findError;

      let fabricId = existing?.id;
      if (fabricId) {
        // `imageOnly` records (e.g. retroactive crop passes) must never
        // overwrite already-reviewed field data with nulls.
        if (!r.imageOnly) {
          const fabricFields = {
            mill_id: millId,
            fabric_code: r.fabric_code,
            fabric_name: r.fabric_name ?? null,
            fabric_type: r.fabric_type ?? null,
            composition: r.composition ?? null,
            gsm: r.gsm ?? null,
            width: r.width ?? null,
            color: r.color ?? null,
            color_family: r.color_family ?? null,
            season: r.season ?? null,
            suggested_use: r.suggested_use ?? null,
            description: r.description ?? null,
            extraction_confidence: r.extraction_confidence ?? null,
            review_status: r.review_status ?? 'needs_review',
          };
          const { error: updateError } = await db.from('fabrics').update(fabricFields).eq('id', fabricId);
          if (updateError) throw updateError;
        }
      } else {
        if (r.imageOnly) throw new Error('imageOnly record but no existing fabric found');
        const fabricFields = {
          mill_id: millId,
          fabric_code: r.fabric_code,
          fabric_name: r.fabric_name ?? null,
          fabric_type: r.fabric_type ?? null,
          composition: r.composition ?? null,
          gsm: r.gsm ?? null,
          width: r.width ?? null,
          color: r.color ?? null,
          color_family: r.color_family ?? null,
          season: r.season ?? null,
          suggested_use: r.suggested_use ?? null,
          description: r.description ?? null,
          extraction_confidence: r.extraction_confidence ?? null,
          review_status: r.review_status ?? 'needs_review',
        };
        const { data: inserted, error: insertError } = await db
          .from('fabrics')
          .insert(fabricFields)
          .select('id')
          .single();
        if (insertError) throw insertError;
        fabricId = inserted.id;
      }

      if (Array.isArray(r.use_tags) && r.use_tags.length) {
        const tagRows = r.use_tags.map((tag) => ({ fabric_id: fabricId, tag: String(tag).toLowerCase().trim() }));
        const { error: tagError } = await db
          .from('fabric_tags')
          .upsert(tagRows, { onConflict: 'fabric_id,tag', ignoreDuplicates: true });
        if (tagError) throw tagError;
      }

      await db.from('fabric_images').delete().eq('fabric_id', fabricId).eq('storage_path', storagePath);
      const { error: imageError } = await db.from('fabric_images').insert({
        fabric_id: fabricId,
        storage_path: storagePath,
        public_url: publicUrl,
        image_type: 'hanger',
        is_primary: true,
      });
      if (imageError) throw imageError;

      ok += 1;
      console.log(`OK  ${r.mill_slug}/${r.fabric_code}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${r.mill_slug}/${r.fabric_code}: ${err.message ?? err}`);
    }
  }

  console.log(`\nDone. ${ok} inserted/updated, ${failed} failed.`);
}

main();

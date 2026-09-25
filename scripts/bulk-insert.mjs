#!/usr/bin/env node
/**
 * Bulk-insert fabrics extracted manually (no OpenAI call) from hanger photos.
 *
 * Usage: npm run bulk-insert -- <batch.json>
 *
 * batch.json is an array of:
 *   {
 *     mill_slug, fabric_code, fabric_name, fabric_type, composition,
 *     gsm, width, color, color_family, season, suggested_use, use_tags, description,
 *     image_path (absolute path to the source photo on disk),
 *     extraction_confidence, review_status
 *   }
 *
 * Optional per-record image fixes: `rotate` (0/90/180/270, clockwise) and
 * `crop` ({ x, y, w, h } as 0-1 fractions of the rotated image).
 *
 * Upserts fabrics on (mill_id, fabric_code), uploads the source photo to
 * Storage, and attaches it (as the cover if the fabric has none yet).
 */

import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { adminClient, STORAGE_BUCKET, contentTypeFor } from './lib/common.mjs';
import { storagePaths } from '../lib/config/storage.config.ts';

const db = adminClient();
const bucket = STORAGE_BUCKET();

const batchPath = process.argv[2];
if (!batchPath) {
  console.error('Usage: npm run bulk-insert -- <batch.json>');
  process.exit(1);
}

/** Row mapping for a batch record — one definition, used by insert and update. */
function fabricFieldsFor(r, millId) {
  return {
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
}

/** Opt-in escape hatch: re-extract over rows a human already approved/rejected. */
const overwriteReviewed = process.env.BULK_INSERT_OVERWRITE_REVIEWED === '1';

/** There is no reliable heuristic for these source photos — neither raw
 * dimensions nor a fixed angle predicts the fix (verified: different photos
 * in the same folder need -90, 180, or no rotation at all). So a record must
 * carry an explicit `rotate` value determined by viewing that photo; records
 * without one are uploaded untouched rather than guessed.
 *
 * `crop` lets a multi-colourway range-card photo yield a distinct swatch
 * image per fabric record. */
async function imageBytes(r) {
  if (!r.rotate && !r.crop) return readFileSync(r.image_path);
  let img = sharp(r.image_path);
  if (r.rotate) img = sharp(await img.rotate(r.rotate).toBuffer());
  if (r.crop) {
    const { width, height } = await img.metadata();
    img = img.extract({
      left: Math.round(r.crop.x * width),
      top: Math.round(r.crop.y * height),
      width: Math.max(1, Math.round(r.crop.w * width)),
      height: Math.max(1, Math.round(r.crop.h * height)),
    });
  }
  return img.toBuffer();
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
  let preserved = 0;

  for (const r of records) {
    try {
      // An unread code must not upsert onto (mill, '') — that silently merged
      // every unreadable label into one record. Give each photo its own
      // placeholder code instead; it stays in needs_review for a human.
      if (!String(r.fabric_code ?? '').trim()) {
        r.fabric_code = `UNREAD-${createHash('md5').update(readFileSync(r.image_path)).digest('hex').slice(0, 8)}`;
      }
      const millId = await resolveMill(r.mill_slug);
      const filename = basename(r.image_path);
      const storagePath = storagePaths.fabricImage(r.mill_slug, r.fabric_code, filename);
      const buffer = await imageBytes(r);

      const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(storagePath, buffer, { contentType: contentTypeFor(filename), upsert: true });
      if (uploadError) throw uploadError;
      const publicUrl = db.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;

      const { data: existing, error: findError } = await db
        .from('fabrics')
        .select('id, review_status')
        .eq('mill_id', millId)
        .eq('fabric_code', r.fabric_code)
        .maybeSingle();
      if (findError) throw findError;

      let fabricId = existing?.id;
      if (fabricId) {
        // Never let a re-import undo a human decision.
        //
        // A single fabric_code is usually photographed several times (front/back,
        // duplicate hanger shots), so the same record gets re-imported on later
        // passes. If those passes rewrote the row, an already-reviewed fabric
        // would silently revert to `needs_review` and any corrections a reviewer
        // typed in the queue would be overwritten by fresh model output.
        //
        // So: once a record has been approved or rejected, the import only
        // attaches the new image. Records still sitting in the queue are
        // refreshed as normal. Set BULK_INSERT_OVERWRITE_REVIEWED=1 to force a
        // full re-extraction over reviewed rows.
        const reviewed = existing.review_status === 'approved' || existing.review_status === 'rejected';
        const skipFields = r.imageOnly || (reviewed && !overwriteReviewed);

        if (skipFields) {
          if (reviewed && !r.imageOnly) preserved += 1;
        } else {
          const { error: updateError } = await db
            .from('fabrics')
            .update(fabricFieldsFor(r, millId))
            .eq('id', fabricId);
          if (updateError) throw updateError;
        }
      } else {
        if (r.imageOnly) throw new Error('imageOnly record but no existing fabric found');
        const { data: inserted, error: insertError } = await db
          .from('fabrics')
          .insert(fabricFieldsFor(r, millId))
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
      const { count: primaries } = await db
        .from('fabric_images')
        .select('id', { count: 'exact', head: true })
        .eq('fabric_id', fabricId)
        .eq('is_primary', true);
      const { error: imageError } = await db.from('fabric_images').insert({
        fabric_id: fabricId,
        storage_path: storagePath,
        public_url: publicUrl,
        image_type: 'hanger',
        is_primary: !primaries, // first image stays the cover; later shots join the gallery
      });
      if (imageError) throw imageError;

      ok += 1;
      console.log(`OK  ${r.mill_slug}/${r.fabric_code}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${r.mill_slug}/${r.fabric_code}: ${err.message ?? err}`);
    }
  }

  console.log(
    `\nDone. ${ok} inserted/updated, ${failed} failed` +
      (preserved ? `, ${preserved} left untouched (already reviewed)` : '') +
      '.',
  );
}

main();

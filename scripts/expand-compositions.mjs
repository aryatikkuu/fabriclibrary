/**
 * Write hanger fibre codes out in words across the library, so text search
 * finds them: "W/P/ELA 52/43/05" → "52% Wool, 43% Polyester, 5% Elastane".
 * Same rules as new imports (features/fabrics/composition.ts): anything the
 * converter isn't sure of is left as printed and listed for a person to fix.
 *
 *   npm run compositions            dry run: what would change, what can't
 *   npm run compositions -- --save  write the changes (run `npm run backup` first)
 *
 * No AI, no cost. The report goes to reports/expand-compositions.json.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { adminClient, hasFlag, mapPool, selectAll } from './lib/common.mjs';
import { readableComposition } from '../features/fabrics/composition.ts';

const SAVE = hasFlag('save');
const REPORT = 'reports/expand-compositions.json';
/** Looks like codes + numbers ("C/P 65/35", "PV/ELA-62/33/05"), whether or not it converted. */
const LOOKS_CODED = /\b[A-Z]{1,4}\s*\/\s*[A-Z]{1,4}\b.*\d/i;

const db = adminClient();
const fabrics = await selectAll(db, 'fabrics', 'id, fabric_code, composition');

const changes = [];
const leftAsPrinted = [];
for (const f of fabrics) {
  if (!f.composition) continue;
  const readable = readableComposition(f.composition);
  if (readable !== f.composition) changes.push({ id: f.id, code: f.fabric_code, from: f.composition, to: readable });
  else if (LOOKS_CODED.test(f.composition)) leftAsPrinted.push({ id: f.id, code: f.fabric_code, composition: f.composition });
}

mkdirSync('reports', { recursive: true });
writeFileSync(REPORT, JSON.stringify({ changes, leftAsPrinted }, null, 2));
console.log(`${changes.length} to write out in words, ${leftAsPrinted.length} coded ones left as printed (see ${REPORT}).`);
for (const c of changes.slice(0, 10)) console.log(`  ${c.from}  →  ${c.to}`);

if (!SAVE) {
  console.log('\nDry run — nothing written. Re-run with --save (after npm run backup).');
} else {
  let failed = 0;
  await mapPool(changes, 8, async (c) => {
    const { error } = await db.from('fabrics').update({ composition: c.to }).eq('id', c.id);
    if (error) { failed++; console.error(`  ${c.code ?? c.id}: ${error.message}`); }
  });
  console.log(`Saved ${changes.length - failed}/${changes.length}.`);
}

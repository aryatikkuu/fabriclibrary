#!/usr/bin/env node
/**
 * Seed the database with the initial mills.
 *
 * Usage:
 *   1. Copy .env.example to .env.local and fill in:
 *      NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   2. Run: npm run db:seed
 *
 * This inserts via the Supabase service-role client (bypasses RLS), so it is
 * safe to run before any users exist. It is idempotent: mills upsert on slug
 *
 * Equivalent raw SQL lives in database/seed/seed.sql if you prefer to paste
 * it into the Supabase SQL editor instead.
 */

import { adminClient } from './lib/common.mjs';

const db = adminClient();

// --- Seed data ---------------------------------------------------------------
const mills = [
  {
    name: 'Masood Textile Mills',
    slug: 'masood-textile-mills',
    description:
      'Vertically integrated knitwear mill in Faisalabad, Pakistan — single jerseys, interlocks, ribs, piques and fleece for global apparel programs.',
    country: 'Pakistan',
    is_active: true,
  },
  {
    name: 'Banswara Syntex',
    slug: 'banswara-syntex',
    description:
      'Integrated textile producer in Rajasthan, India — spun yarns and woven suiting, technical blends and sustainable fibre programs.',
    country: 'India',
    is_active: true,
  },
  {
    name: 'Orbit Exports',
    slug: 'orbit-exports',
    description:
      'Specialist weaver in Mumbai and Surat, India — occasion-wear novelties: satins, jacquards, lurex, crepes and embellished wovens.',
    country: 'India',
    is_active: true,
  },
];


// --- Run ---------------------------------------------------------------------
async function main() {
  console.log('Seeding mills…');
  const { data: millRows, error: millError } = await db
    .from('mills')
    .upsert(mills, { onConflict: 'slug' })
    .select('id, slug');
  if (millError) throw millError;

  console.log('Done. Mills:', millRows.length);
  console.log('Fabrics are imported from hanger photos via scripts/bulk-insert.mjs.');
}

main().catch((error) => {
  console.error('Seed failed:', error.message ?? error);
  process.exit(1);
});

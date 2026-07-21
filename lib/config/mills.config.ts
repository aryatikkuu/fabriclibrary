/**
 * Mill registry. The database is the source of truth at runtime; this config
 * drives seeding, storage path slugs and homepage ordering. Add a mill here
 * and in the database — no business logic changes required.
 * See docs/ADDING_NEW_MILL.md.
 */
export interface MillConfig {
  name: string;
  slug: string;
  country: string;
  shortLine: string;
}

export const millsConfig: MillConfig[] = [
  {
    name: 'Masood Textile Mills',
    slug: 'masood-textile-mills',
    country: 'Pakistan',
    shortLine: 'Knits — jerseys, interlocks, ribs, fleece.',
  },
  {
    name: 'Banswara Syntex',
    slug: 'banswara-syntex',
    country: 'India',
    shortLine: 'Yarn-dyed wovens, viscose blends, suiting.',
  },
  {
    name: 'Orbit Exports',
    slug: 'orbit-exports',
    country: 'India',
    shortLine: 'Novelty wovens — jacquards, satins, lurex.',
  },
];

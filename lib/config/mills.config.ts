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

/**
 * Fabrics from mills TMS doesn't represent live under this "mill", so the
 * actual mill is never shown. It isn't counted as a partner mill.
 */
export const EXTENDED_RANGE_SLUG = 'extended-range';

export const isPartnerMill = (slug: string) => slug !== EXTENDED_RANGE_SLUG;

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
  {
    // Photos and descriptions of these fabrics must not name the real mill either.
    name: 'Extended Range',
    slug: EXTENDED_RANGE_SLUG,
    country: 'Various mills',
    shortLine: 'Further qualities, sourced on request.',
  },
];

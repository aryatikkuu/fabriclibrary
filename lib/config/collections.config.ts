/**
 * Collections: a mill's swatch book (one quality in many colours, or a few
 * blends in many colours) or a set of hangers (many qualities of one kind),
 * shown on its own page instead of in the fabric archive. Each swatch is a fabric whose `collection` column holds the slug
 * below (migration 0013). Add a book here, then set that column on its
 * swatches; nothing else changes.
 */
export interface CollectionConfig {
  slug: string;
  name: string;
  millSlug: string;
  /** One or two sentences for the collection page and its card. */
  description: string;
  /** What one entry is called: a colour of a swatch book, or a quality of a hanger set. */
  item: { one: string; many: string };
  /** Label of the filter over fabric names (the book's blends, or the hangers' fabric kinds). */
  nameFilter: string;
}

const colour = { one: 'colour', many: 'colours' };

export const collectionsConfig: readonly CollectionConfig[] = [
  {
    slug: 'masood-cotton-melange',
    name: '100% Cotton Melange',
    millSlug: 'masood-textile-mills',
    description:
      'Vol. 05 colour card — melange knits in 100% cotton, from light heathers to deep darks across greys, browns, yellows, greens, blues, reds and purples.',
    item: colour,
    nameFilter: 'Blend',
  },
  {
    slug: 'masood-blend-collection',
    name: 'Blend Collection',
    millSlug: 'masood-textile-mills',
    description:
      'Heathered knits in fourteen blends — PC/CVC, viscose, modal, Coolmax, bamboo, Tencel, Thermolite, silk and acrylic with cotton, tri blend, polyester, viscose and linen/polyester.',
    item: colour,
    nameFilter: 'Blend',
  },
  {
    slug: 'masood-single-jersey',
    name: 'Single Jersey Hangers',
    millSlug: 'masood-textile-mills',
    description:
      'Jersey hanger set — plain, slub, spandex, feed and auto stripe, plaited and textured single jerseys, each with its full label: yarn, GSM and width.',
    item: { one: 'quality', many: 'qualities' },
    nameFilter: 'Fabric',
  },
];

export const findCollection = (slug: string) => collectionsConfig.find((c) => c.slug === slug);

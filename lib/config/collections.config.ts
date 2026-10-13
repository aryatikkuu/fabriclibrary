/**
 * Collections: a mill's swatch book — one quality in many colours (or a few
 * blends in many colours) — shown on its own page instead of in the fabric
 * archive. Each swatch is a fabric whose `collection` column holds the slug
 * below (migration 0013). Add a book here, then set that column on its
 * swatches; nothing else changes.
 */
export interface CollectionConfig {
  slug: string;
  name: string;
  millSlug: string;
  /** One or two sentences for the collection page and its card. */
  description: string;
}

export const collectionsConfig: readonly CollectionConfig[] = [
  {
    slug: 'masood-cotton-melange',
    name: 'Masood Melange Collection (Knits)',
    millSlug: 'masood-textile-mills',
    description:
      'Vol. 05 colour card — melange knits in 100% cotton, from light heathers to deep darks across greys, browns, yellows, greens, blues, reds and purples.',
  },
  {
    slug: 'masood-blend-collection',
    name: 'Blend Collection',
    millSlug: 'masood-textile-mills',
    description:
      'Heathered knits in fourteen blends — PC/CVC, viscose, modal, Coolmax, bamboo, Tencel, Thermolite, silk and acrylic with cotton, tri blend, polyester, viscose and linen/polyester.',
  },
];

export const findCollection = (slug: string) => collectionsConfig.find((c) => c.slug === slug);

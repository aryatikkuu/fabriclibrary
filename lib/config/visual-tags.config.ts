/**
 * Controlled vocabulary for the visual tags the AI assigns to each fabric
 * (scripts/verify-and-tag.mjs). Image search compares these tags, so every
 * fabric must be described with the same words: a fixed list means "check",
 * "plaid" and "tartan" can never become three tags that fail to match.
 *
 * Stored in fabric_tags as "<group>:<value>", e.g. "pattern:floral",
 * alongside the existing end-use tags ("shirts", "suiting", …).
 * Extend a list here and re-run the tagger; nothing else hard-codes them.
 */
export const visualTags = {
  pattern: [
    'solid', 'textured-solid', 'stripe', 'check', 'floral', 'botanical', 'geometric',
    'abstract', 'animal', 'paisley', 'dot', 'damask', 'camouflage', 'melange', 'novelty',
  ],
  scale: ['none', 'small', 'medium', 'large'],
  colour: [
    'white', 'cream', 'beige', 'khaki', 'brown', 'black', 'charcoal', 'grey', 'silver',
    'navy', 'blue', 'sky-blue', 'teal', 'green', 'olive', 'mint', 'yellow', 'mustard',
    'gold', 'orange', 'rust', 'red', 'burgundy', 'pink', 'blush', 'purple', 'lavender',
  ],
  texture: [
    'smooth', 'brushed', 'ribbed', 'waffle', 'seersucker', 'crinkle', 'slub', 'boucle',
    'quilted', 'embossed', 'mesh', 'lace', 'pile',
  ],
  finish: ['matte', 'sheen', 'metallic', 'transparent'],
  construction: ['knit', 'woven', 'non-woven'],
  technique: ['plain', 'printed', 'yarn-dyed', 'jacquard', 'dobby', 'embroidered', 'burnout'],
} as const;

export type VisualTagGroup = keyof typeof visualTags;

/**
 * Photo-search ranking (database function match_fabrics_by_look).
 * Per group, the score is the overlap of the searched tags with the fabric's
 * tags; groups are then averaged with these weights, so pattern and colour
 * decide most of the ranking. "use" is the end-use tags from the buyer's note
 * ("for summer shirts"): any one matching tag counts in full, because the
 * stored use tags contain synonyms (shirts / shirting / shirtings).
 */
export const lookSearch = {
  weights: {
    pattern: 3, colour: 3, use: 2, technique: 2, texture: 1.5, scale: 1, construction: 1, finish: 0.5,
  },
  /** Hide fabrics matching less than this share of the weighted search (0–1). */
  minScore: 0.3,
  /** End-use tags offered to the AI: those on at least this many fabrics. */
  minUseTagCount: 20,
  /**
   * Weight of description similarity against the tag score (migration 0008):
   * score = (tags + w · cosine) / (1 + w). 0.5 won the benchmark in
   * reports/embedding-benchmark.json; 0 turns it off.
   */
  embeddingWeight: 0.5,
  /** Library and search must use the same model — change both via `npm run embed -- --all`. */
  embeddingModel: 'text-embedding-3-small',
} as const;

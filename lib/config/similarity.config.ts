/**
 * Rule-based similarity tuning (V1).
 * Weights sum to 100 so the score reads as a percentage.
 */
export const similarityConfig = {
  /** GSM difference treated as "the same weight class". */
  gsmRange: 10,
  /** GSM difference beyond which the weight contribution is zero. */
  gsmMaxRange: 40,
  weights: {
    fabricType: 30,
    gsm: 25,
    composition: 25,
    colorFamily: 15,
    sameMill: 5,
  },
  /** How many similar fabrics to persist and show on a detail page. */
  topN: 6,
  /** Minimum score worth storing. */
  minScore: 30,
} as const;

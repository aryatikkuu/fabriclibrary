import { similarityConfig } from '@/lib/config/similarity.config';
import type { Fabric } from '@/types/fabric';

export interface SimilarityScore {
  score: number;
  reasons: string[];
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/** Tokenise a composition string into fibre terms, ignoring percentages. */
export function compositionTokens(composition: string | null | undefined): string[] {
  return norm(composition)
    .replace(/\d+(\.\d+)?\s*%?/g, ' ')
    .split(/[^a-z]+/)
    .filter((t) => t.length > 2);
}

/**
 * V1 rule-based similarity (0–100). Pure function — easy to test and to
 * blend with embedding (V2) or visual (V3) scores later.
 */
export function computeSimilarity(a: Fabric, b: Fabric): SimilarityScore {
  const { weights, gsmRange, gsmMaxRange } = similarityConfig;
  let score = 0;
  const reasons: string[] = [];

  // Fabric type — the strongest signal.
  if (norm(a.fabric_type) && norm(a.fabric_type) === norm(b.fabric_type)) {
    score += weights.fabricType;
    reasons.push(`Same fabric type (${a.fabric_type})`);
  }

  // GSM — full weight within ±gsmRange, linear falloff to gsmMaxRange.
  if (a.gsm != null && b.gsm != null) {
    const diff = Math.abs(a.gsm - b.gsm);
    if (diff <= gsmRange) {
      score += weights.gsm;
      reasons.push(`Weight within ±${gsmRange} GSM`);
    } else if (diff < gsmMaxRange) {
      const factor = 1 - (diff - gsmRange) / (gsmMaxRange - gsmRange);
      score += weights.gsm * factor;
      reasons.push(`Close weight (${diff} GSM apart)`);
    }
  }

  // Composition — Jaccard overlap of fibre tokens.
  const tokensA = new Set(compositionTokens(a.composition));
  const tokensB = new Set(compositionTokens(b.composition));
  if (tokensA.size && tokensB.size) {
    const intersection = [...tokensA].filter((t) => tokensB.has(t));
    const union = new Set([...tokensA, ...tokensB]);
    const overlap = intersection.length / union.size;
    if (overlap > 0) {
      score += weights.composition * overlap;
      if (overlap >= 0.99) reasons.push('Same composition');
      else reasons.push(`Shared fibres (${intersection.join(', ')})`);
    }
  }

  if (norm(a.color_family) && norm(a.color_family) === norm(b.color_family)) {
    score += weights.colorFamily;
    reasons.push(`Same colour family (${a.color_family})`);
  }

  if (a.mill_id === b.mill_id) {
    score += weights.sameMill;
    reasons.push('Same mill');
  }

  return { score: Math.min(100, Math.round(score * 100) / 100), reasons };
}

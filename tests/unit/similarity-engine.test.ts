import { describe, it, expect } from 'vitest';
import { computeSimilarity, compositionTokens } from '@/features/similarity/similarity-engine';
import { similarityConfig } from '@/lib/config/similarity.config';
import type { Fabric } from '@/types/fabric';

/** Minimal fabric factory for similarity tests. */
function fabric(overrides: Partial<Fabric>): Fabric {
  return {
    id: 'f-' + Math.random().toString(36).slice(2),
    mill_id: 'mill-a',
    fabric_code: 'TEST',
    fabric_name: null,
    fabric_type: null,
    composition: null,
    gsm: null,
    width: null,
    color: null,
    color_family: null,
    season: null,
    description: null,
    ai_description: null,
    suggested_use: null,
    extraction_confidence: null,
    review_status: 'approved',
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('compositionTokens', () => {
  it('extracts fibre names and ignores percentages', () => {
    expect(compositionTokens('97% Polyester 3% Spandex')).toEqual(['polyester', 'spandex']);
  });

  it('returns an empty array for null', () => {
    expect(compositionTokens(null)).toEqual([]);
  });
});

describe('computeSimilarity', () => {
  it('gives an identical fabric (different mill) the full non-mill score', () => {
    const a = fabric({
      mill_id: 'mill-a',
      fabric_type: 'Satin Weave',
      gsm: 190,
      composition: '100% Polyester',
      color_family: 'White',
    });
    const b = fabric({ ...a, id: 'other', mill_id: 'mill-b' });

    const { score } = computeSimilarity(a, b);
    const expected =
      similarityConfig.weights.fabricType +
      similarityConfig.weights.gsm +
      similarityConfig.weights.composition +
      similarityConfig.weights.colorFamily;
    expect(score).toBe(expected);
  });

  it('adds the same-mill bonus', () => {
    const a = fabric({ fabric_type: 'Interlock', mill_id: 'mill-a' });
    const b = fabric({ fabric_type: 'Interlock', mill_id: 'mill-a' });
    const c = fabric({ fabric_type: 'Interlock', mill_id: 'mill-b' });

    const sameMill = computeSimilarity(a, b).score;
    const otherMill = computeSimilarity(a, c).score;
    expect(sameMill - otherMill).toBe(similarityConfig.weights.sameMill);
  });

  it('awards full GSM weight within the configured range', () => {
    const a = fabric({ gsm: 180, mill_id: 'mill-a' });
    const b = fabric({ gsm: 180 + similarityConfig.gsmRange, mill_id: 'mill-b' });
    const { score, reasons } = computeSimilarity(a, b);
    expect(score).toBe(similarityConfig.weights.gsm);
    expect(reasons.join(' ')).toMatch(/GSM/);
  });

  it('decays GSM weight linearly between range and max range', () => {
    const mid =
      similarityConfig.gsmRange +
      (similarityConfig.gsmMaxRange - similarityConfig.gsmRange) / 2;
    const a = fabric({ gsm: 200, mill_id: 'mill-a' });
    const b = fabric({ gsm: 200 + mid, mill_id: 'mill-b' });
    const { score } = computeSimilarity(a, b);
    expect(score).toBeCloseTo(similarityConfig.weights.gsm / 2, 5);
  });

  it('gives zero GSM weight beyond the max range', () => {
    const a = fabric({ gsm: 100, mill_id: 'mill-a' });
    const b = fabric({ gsm: 100 + similarityConfig.gsmMaxRange + 5, mill_id: 'mill-b' });
    expect(computeSimilarity(a, b).score).toBe(0);
  });

  it('scores partial composition overlap with Jaccard', () => {
    const a = fabric({ composition: '80% Cotton 20% Polyester', mill_id: 'mill-a' });
    const b = fabric({ composition: '100% Cotton', mill_id: 'mill-b' });
    // Tokens: {cotton, polyester} vs {cotton} → overlap 1/2.
    expect(computeSimilarity(a, b).score).toBeCloseTo(similarityConfig.weights.composition / 2, 5);
  });

  it('matches text fields case-insensitively', () => {
    const a = fabric({ fabric_type: 'satin weave', mill_id: 'mill-a' });
    const b = fabric({ fabric_type: 'Satin Weave', mill_id: 'mill-b' });
    expect(computeSimilarity(a, b).score).toBe(similarityConfig.weights.fabricType);
  });

  it('never exceeds 100', () => {
    const a = fabric({
      fabric_type: 'Rib',
      gsm: 220,
      composition: '100% Cotton',
      color_family: 'Black',
      mill_id: 'mill-a',
    });
    const b = fabric({ ...a, id: 'b' });
    expect(computeSimilarity(a, b).score).toBeLessThanOrEqual(100);
  });
});

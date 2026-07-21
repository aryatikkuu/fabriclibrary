import type { FabricRepository } from '@/repositories/fabric.repository';
import type { SimilarityRepository } from '@/repositories/similarity.repository';
import { computeSimilarity } from '@/features/similarity/similarity-engine';
import { similarityConfig } from '@/lib/config/similarity.config';
import type { Fabric, FabricSimilarity, FabricWithRelations } from '@/types/fabric';

/**
 * SimilarityService — V1 rule-based scoring.
 * V2 (embeddings) and V3 (visual) plug in here later: compute their scores,
 * blend with the rule-based score, and write rows with their own
 * similarity_method. Nothing else in the app needs to change.
 */
export class SimilarityService {
  constructor(
    private readonly fabrics: FabricRepository,
    private readonly similarities: SimilarityRepository,
  ) {}

  /** Recompute and persist the top-N similar fabrics for one source fabric. */
  async recalculateForFabric(fabricId: string): Promise<number> {
    const source = await this.fabrics.findById(fabricId);
    const candidates = await this.fabrics.findSimilarityCandidates(source as Fabric);

    const scored = candidates
      .map((candidate) => ({ candidate, ...computeSimilarity(source as Fabric, candidate) }))
      .filter((entry) => entry.score >= similarityConfig.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, similarityConfig.topN);

    await this.similarities.replaceForFabric(
      fabricId,
      scored.map((entry) => ({
        source_fabric_id: fabricId,
        similar_fabric_id: entry.candidate.id,
        similarity_score: entry.score,
        similarity_reason: entry.reasons.join('; '),
        similarity_method: 'rule_based' as const,
      })),
    );

    return scored.length;
  }

  getTopSimilar(fabricId: string): Promise<{ similarity: FabricSimilarity; fabric: FabricWithRelations }[]> {
    return this.similarities.findTopSimilar(fabricId, similarityConfig.topN);
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FabricSimilarity, FabricWithRelations } from '@/types/fabric';

export class SimilarityRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** Replace all rule-based similarity rows for a source fabric. */
  async replaceForFabric(
    sourceFabricId: string,
    rows: Omit<FabricSimilarity, 'id' | 'created_at'>[],
  ): Promise<void> {
    const { error: deleteError } = await this.db
      .from('fabric_similarities')
      .delete()
      .eq('source_fabric_id', sourceFabricId)
      .eq('similarity_method', 'rule_based');
    if (deleteError) throw deleteError;

    if (rows.length === 0) return;
    const { error } = await this.db.from('fabric_similarities').insert(rows);
    if (error) throw error;
  }

  /** Top similar fabrics joined with their fabric records. */
  async findTopSimilar(sourceFabricId: string, limit: number): Promise<
    { similarity: FabricSimilarity; fabric: FabricWithRelations }[]
  > {
    const { data, error } = await this.db
      .from('fabric_similarities')
      .select('*, fabric:fabrics!fabric_similarities_similar_fabric_id_fkey(*, mill:mills(id, name, slug), images:fabric_images(*))')
      .eq('source_fabric_id', sourceFabricId)
      .order('similarity_score', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data ?? []).map((row: Record<string, unknown>) => {
      const { fabric, ...similarity } = row;
      return {
        similarity: similarity as unknown as FabricSimilarity,
        fabric: fabric as unknown as FabricWithRelations,
      };
    });
  }
}

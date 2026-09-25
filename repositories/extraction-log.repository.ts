import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExtractionLogInsert {
  fabric_id?: string | null;
  source_image_path?: string | null;
  raw_ai_response?: string | null;
  extracted_json?: unknown;
  confidence_score?: number | null;
  extraction_status: 'success' | 'partial' | 'failed';
  error_message?: string | null;
}

export class ExtractionLogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(log: ExtractionLogInsert): Promise<void> {
    const { error } = await this.db.from('ai_extraction_logs').insert(log);
    if (error) throw error;
  }

  async findByFabricId(fabricId: string) {
    const { data, error } = await this.db
      .from('ai_extraction_logs')
      .select('*')
      .eq('fabric_id', fabricId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Codes the label re-read (scripts/verify-and-tag.mjs) suggests instead of the
   * stored one, for the review queue: fabric id -> suggested code.
   */
  async findCodeSuggestions(fabricIds: string[]): Promise<Record<string, string>> {
    if (fabricIds.length === 0) return {};
    const { data, error } = await this.db
      .from('ai_extraction_logs')
      .select('fabric_id, suggestion:extracted_json->>code_suggestion')
      .in('fabric_id', fabricIds)
      .not('extracted_json->>code_suggestion', 'is', null);
    if (error) throw error;
    return Object.fromEntries(((data ?? []) as { fabric_id: string; suggestion: string }[]).map((r) => [r.fabric_id, r.suggestion]));
  }
}

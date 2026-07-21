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
}

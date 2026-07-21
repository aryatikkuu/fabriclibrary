import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogInsert {
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  before_data?: unknown;
  after_data?: unknown;
}

export class AuditLogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(entry: AuditLogInsert): Promise<void> {
    const { error } = await this.db.from('audit_logs').insert(entry);
    if (error) throw error;
  }
}

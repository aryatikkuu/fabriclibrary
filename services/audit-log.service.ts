import type { AuditLogRepository, AuditLogInsert } from '@/repositories/audit-log.repository';

/** Records significant actions. Failures are logged, never user-facing. */
export class AuditLogService {
  constructor(private readonly auditLogs: AuditLogRepository) {}

  async record(entry: AuditLogInsert): Promise<void> {
    try {
      await this.auditLogs.insert(entry);
    } catch (error) {
      console.error('[audit] failed to record entry', entry.action, error);
    }
  }
}

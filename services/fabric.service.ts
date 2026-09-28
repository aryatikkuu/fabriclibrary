import type { FabricRepository } from '@/repositories/fabric.repository';
import type { AuditLogService } from '@/services/audit-log.service';
import type {
  Fabric,
  FabricSearchParams,
  FabricWithRelations,
  Paginated,
} from '@/types/fabric';
import {
  fabricCreateSchema,
  fabricUpdateSchema,
  type FabricCreateInput,
  type FabricUpdateInput,
} from '@/features/fabrics/types/fabric.schema';
import { showcase } from '@/lib/config/app.config';

/** Fabric use-cases. Validation happens here; persistence in the repository. */
export class FabricService {
  constructor(
    private readonly fabrics: FabricRepository,
    private readonly audit: AuditLogService,
  ) {}

  getById(id: string): Promise<FabricWithRelations> {
    return this.fabrics.findById(id);
  }

  search(params: FabricSearchParams): Promise<Paginated<FabricWithRelations>> {
    return this.fabrics.search(params);
  }

  searchByMill(millSlug: string, params: Omit<FabricSearchParams, 'millSlug'> = {}) {
    return this.fabrics.search({ ...params, millSlug });
  }

  /**
   * Home page picks from the best-described fabrics: the newest few as
   * "recent", then `featured` dealt out one mill at a time (best first
   * within each mill) so no single mill fills the page.
   */
  async showcase(): Promise<{ featured: FabricWithRelations[]; recent: FabricWithRelations[] }> {
    const candidates = await this.fabrics.findShowcaseCandidates();
    const recent = [...candidates]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, showcase.recent);

    const byMill = new Map<string, FabricWithRelations[]>();
    for (const fabric of candidates) {
      if (recent.includes(fabric)) continue;
      byMill.set(fabric.mill_id, [...(byMill.get(fabric.mill_id) ?? []), fabric]);
    }
    const featured: FabricWithRelations[] = [];
    const queues = [...byMill.values()];
    while (featured.length < showcase.featured && queues.some((q) => q.length)) {
      for (const queue of queues) {
        const next = queue.shift();
        if (next && featured.length < showcase.featured) featured.push(next);
      }
    }
    return { featured, recent };
  }

  async create(input: FabricCreateInput, userId?: string): Promise<Fabric> {
    const parsed = fabricCreateSchema.parse(input);
    const fabric = await this.fabrics.create(parsed);
    await this.audit.record({
      user_id: userId ?? null,
      action: 'fabric.create',
      entity_type: 'fabric',
      entity_id: fabric.id,
      after_data: fabric,
    });
    return fabric;
  }

  async update(id: string, input: FabricUpdateInput, userId?: string): Promise<Fabric> {
    const parsed = fabricUpdateSchema.parse(input);
    const before = await this.fabrics.findById(id);
    const fabric = await this.fabrics.update(id, parsed);
    await this.audit.record({
      user_id: userId ?? null,
      action: 'fabric.update',
      entity_type: 'fabric',
      entity_id: id,
      before_data: before,
      after_data: fabric,
    });
    return fabric;
  }

  async remove(id: string, userId?: string): Promise<void> {
    const before = await this.fabrics.findById(id);
    await this.fabrics.delete(id);
    await this.audit.record({
      user_id: userId ?? null,
      action: 'fabric.delete',
      entity_type: 'fabric',
      entity_id: id,
      before_data: before,
    });
  }
}

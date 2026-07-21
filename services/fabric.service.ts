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

/** Fabric use-cases. Validation happens here; persistence in the repository. */
export class FabricService {
  constructor(
    private readonly fabrics: FabricRepository,
    private readonly audit: AuditLogService,
  ) {}

  getById(id: string): Promise<FabricWithRelations> {
    return this.fabrics.findById(id);
  }

  getByCode(code: string): Promise<FabricWithRelations | null> {
    return this.fabrics.findByCode(code);
  }

  search(params: FabricSearchParams): Promise<Paginated<FabricWithRelations>> {
    return this.fabrics.search(params);
  }

  searchByMill(millSlug: string, params: Omit<FabricSearchParams, 'millSlug'> = {}) {
    return this.fabrics.search({ ...params, millSlug });
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

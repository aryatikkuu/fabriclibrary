import type { MillRepository } from '@/repositories/mill.repository';
import type { FabricRepository } from '@/repositories/fabric.repository';
import type { Mill } from '@/types/mill';

export interface MillWithCount extends Mill {
  fabricCount: number;
}

export class MillService {
  constructor(
    private readonly mills: MillRepository,
    private readonly fabrics: FabricRepository,
  ) {}

  list(): Promise<Mill[]> {
    return this.mills.findAllActive();
  }

  async listWithCounts(): Promise<MillWithCount[]> {
    const mills = await this.mills.findAllActive();
    return Promise.all(
      mills.map(async (mill) => ({
        ...mill,
        fabricCount: await this.fabrics.countByMill(mill.id),
      })),
    );
  }

  getBySlug(slug: string): Promise<Mill> {
    return this.mills.findBySlug(slug);
  }

  /** Resolve a mill from a free-text name (used by AI extraction). */
  resolveByName(name: string): Promise<Mill | null> {
    if (!name.trim()) return Promise.resolve(null);
    return this.mills.findByName(name.trim());
  }
}

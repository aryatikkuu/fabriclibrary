import type { MillRepository } from '@/repositories/mill.repository';
import type { Mill } from '@/types/mill';

export interface MillWithCount extends Mill {
  fabricCount: number;
}

export class MillService {
  constructor(private readonly mills: MillRepository) {}

  list(): Promise<Mill[]> {
    return this.mills.findAllActive();
  }

  listWithCounts(): Promise<MillWithCount[]> {
    return this.mills.findAllActiveWithCounts();
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

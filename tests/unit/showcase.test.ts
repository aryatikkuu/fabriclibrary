import { describe, it, expect } from 'vitest';
import { FabricService } from '@/services/fabric.service';
import type { FabricRepository } from '@/repositories/fabric.repository';
import type { AuditLogService } from '@/services/audit-log.service';
import type { FabricWithRelations } from '@/types/fabric';
import { showcase } from '@/lib/config/app.config';

/** n candidates from one mill, best (highest confidence) first, created a day apart. */
const fromMill = (mill: string, n: number, startDay = 1) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${mill}-${i}`,
    mill_id: mill,
    created_at: `2026-01-${String(startDay + i).padStart(2, '0')}T00:00:00Z`,
  })) as FabricWithRelations[];

const serviceWith = (candidates: FabricWithRelations[]) =>
  new FabricService(
    { findShowcaseCandidates: async () => candidates } as unknown as FabricRepository,
    {} as AuditLogService,
  );

describe('FabricService.showcase', () => {
  it('takes the newest as "recent" and never repeats them in "featured"', async () => {
    const { featured, recent } = await serviceWith([...fromMill('a', 10), ...fromMill('b', 10, 11)]).showcase();
    expect(recent.map((f) => f.id)).toEqual(['b-9', 'b-8', 'b-7', 'b-6'].slice(0, showcase.recent));
    expect(featured.some((f) => recent.includes(f))).toBe(false);
  });

  it('shares "featured" out across mills instead of letting the biggest fill it', async () => {
    const { featured } = await serviceWith([...fromMill('big', 40), ...fromMill('small', 2, 1)]).showcase();
    expect(featured).toHaveLength(showcase.featured);
    expect(featured.filter((f) => f.mill_id === 'small')).toHaveLength(2);
  });

  it('copes with fewer candidates than places', async () => {
    const { featured, recent } = await serviceWith(fromMill('a', 3)).showcase();
    expect(recent).toHaveLength(3);
    expect(featured).toHaveLength(0);
  });
});

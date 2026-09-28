import type { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError } from '@/lib/errors';
import type { Mill } from '@/types/mill';

export class MillRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAllActive(): Promise<Mill[]> {
    const { data, error } = await this.db
      .from('mills')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []) as Mill[];
  }

  /**
   * Active mills with how many fabrics the caller can see in each, in one
   * query (PostgREST aggregate; fabrics RLS applies to the count).
   */
  async findAllActiveWithCounts(): Promise<(Mill & { fabricCount: number })[]> {
    const { data, error } = await this.db
      .from('mills')
      .select('*, fabrics(count)')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []).map(({ fabrics, ...mill }: Mill & { fabrics: { count: number }[] }) => ({
      ...mill,
      fabricCount: fabrics[0]?.count ?? 0,
    }));
  }

  async findBySlug(slug: string): Promise<Mill> {
    const { data, error } = await this.db
      .from('mills')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError('Mill', slug);
    return data as Mill;
  }

  async findByName(name: string): Promise<Mill | null> {
    const { data, error } = await this.db
      .from('mills')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as Mill) ?? null;
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError } from '@/lib/errors';
import type {
  Fabric,
  FabricSearchParams,
  FabricWithRelations,
  Paginated,
} from '@/types/fabric';
import type { FabricCreateInput, FabricUpdateInput } from '@/features/fabrics/types/fabric.schema';

const FABRIC_WITH_RELATIONS = '*, mill:mills(id, name, slug), images:fabric_images(*), tags:fabric_tags(*)';

/** All fabric table access goes through this repository. */
export class FabricRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<FabricWithRelations> {
    const { data, error } = await this.db
      .from('fabrics')
      .select(FABRIC_WITH_RELATIONS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError('Fabric', id);
    return data as unknown as FabricWithRelations;
  }

  async findByCode(fabricCode: string): Promise<FabricWithRelations | null> {
    const { data, error } = await this.db
      .from('fabrics')
      .select(FABRIC_WITH_RELATIONS)
      .ilike('fabric_code', fabricCode)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as FabricWithRelations) ?? null;
  }

  async search(params: FabricSearchParams): Promise<Paginated<FabricWithRelations>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 24;
    const from = (page - 1) * pageSize;

    let query = this.db
      .from('fabrics')
      .select(FABRIC_WITH_RELATIONS + ', mills!inner(slug)', { count: 'exact' });

    if (params.q) {
      const text = params.q.trim();
      query = query.or(
        `fabric_code.ilike.%${text}%,fabric_name.ilike.%${text}%,composition.ilike.%${text}%,fabric_type.ilike.%${text}%,color.ilike.%${text}%,description.ilike.%${text}%,suggested_use.ilike.%${text}%`,
      );
    }
    if (params.millSlug) query = query.eq('mills.slug', params.millSlug);
    if (params.fabricType) query = query.ilike('fabric_type', params.fabricType);
    if (params.colorFamily) query = query.ilike('color_family', params.colorFamily);
    if (params.composition) query = query.ilike('composition', `%${params.composition}%`);
    if (params.gsmMin != null) query = query.gte('gsm', params.gsmMin);
    if (params.gsmMax != null) query = query.lte('gsm', params.gsmMax);
    if (params.reviewStatus) query = query.eq('review_status', params.reviewStatus);

    switch (params.sort) {
      case 'gsm_asc': query = query.order('gsm', { ascending: true, nullsFirst: false }); break;
      case 'gsm_desc': query = query.order('gsm', { ascending: false, nullsFirst: false }); break;
      case 'code': query = query.order('fabric_code', { ascending: true }); break;
      default: query = query.order('created_at', { ascending: false });
    }

    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return {
      items: (data ?? []) as unknown as FabricWithRelations[],
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async create(input: FabricCreateInput): Promise<Fabric> {
    const { data, error } = await this.db.from('fabrics').insert(input).select().single();
    if (error) throw error;
    return data as Fabric;
  }

  async update(id: string, input: FabricUpdateInput): Promise<Fabric> {
    const { data, error } = await this.db
      .from('fabrics')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Fabric;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('fabrics').delete().eq('id', id);
    if (error) throw error;
  }

  async countByMill(millId: string): Promise<number> {
    const { count, error } = await this.db
      .from('fabrics')
      .select('id', { count: 'exact', head: true })
      .eq('mill_id', millId);
    if (error) throw error;
    return count ?? 0;
  }

  async countAll(reviewStatus?: string): Promise<number> {
    let query = this.db.from('fabrics').select('id', { count: 'exact', head: true });
    if (reviewStatus) query = query.eq('review_status', reviewStatus);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  /** Candidate pool for similarity scoring: same type OR overlapping GSM window. */
  async findSimilarityCandidates(fabric: Fabric, limit = 200): Promise<Fabric[]> {
    const filters: string[] = [];
    if (fabric.fabric_type) filters.push(`fabric_type.ilike.${fabric.fabric_type}`);
    if (fabric.gsm != null) filters.push(`and(gsm.gte.${fabric.gsm - 60},gsm.lte.${fabric.gsm + 60})`);

    let query = this.db.from('fabrics').select('*').neq('id', fabric.id).limit(limit);
    if (filters.length > 0) query = query.or(filters.join(','));

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Fabric[];
  }

  async addImage(image: {
    fabric_id: string;
    storage_path: string;
    public_url: string | null;
    image_type?: string;
    is_primary?: boolean;
  }): Promise<void> {
    const { error } = await this.db.from('fabric_images').insert(image);
    if (error) throw error;
  }
}

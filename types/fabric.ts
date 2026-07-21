import type { Mill } from './mill';

export type ReviewStatus = 'approved' | 'needs_review' | 'rejected';
export type SimilarityMethod = 'rule_based' | 'embedding' | 'visual';

export interface Fabric {
  id: string;
  mill_id: string;
  fabric_code: string;
  fabric_name: string | null;
  fabric_type: string | null;
  composition: string | null;
  gsm: number | null;
  width: string | null;
  color: string | null;
  color_family: string | null;
  season: string | null;
  description: string | null;
  ai_description: string | null;
  suggested_use: string | null;
  extraction_confidence: number | null;
  review_status: ReviewStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FabricImage {
  id: string;
  fabric_id: string;
  storage_path: string;
  public_url: string | null;
  image_type: 'hanger' | 'fabric' | 'qr' | 'detail' | 'other';
  is_primary: boolean;
  uploaded_at: string;
}

export interface FabricDocument {
  id: string;
  fabric_id: string;
  document_name: string;
  document_type: 'datasheet' | 'certificate' | 'testing_report' | 'other';
  storage_path: string;
  public_url: string | null;
  uploaded_at: string;
}

export interface FabricTag {
  id: string;
  fabric_id: string;
  tag: string;
  created_at: string;
}

export interface FabricSimilarity {
  id: string;
  source_fabric_id: string;
  similar_fabric_id: string;
  similarity_score: number;
  similarity_reason: string | null;
  similarity_method: SimilarityMethod;
  created_at: string;
}

/** Fabric joined with its mill, primary image and tags — the shape most UI needs. */
export interface FabricWithRelations extends Fabric {
  mill: Pick<Mill, 'id' | 'name' | 'slug'> | null;
  images: FabricImage[];
  tags?: FabricTag[];
}

export interface FabricSearchParams {
  q?: string;
  millSlug?: string;
  fabricType?: string;
  colorFamily?: string;
  composition?: string;
  gsmMin?: number;
  gsmMax?: number;
  reviewStatus?: ReviewStatus;
  sort?: 'newest' | 'gsm_asc' | 'gsm_desc' | 'code';
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

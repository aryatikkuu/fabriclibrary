/** Shape returned by the AI extraction service after validation. */
export interface ExtractionResult {
  mill_name: string;
  fabric_code: string;
  fabric_name: string;
  fabric_type: string;
  composition: string;
  gsm: number | null;
  width: string;
  color: string;
  color_family: string;
  season: string;
  suggested_use: string;
  use_tags: string[];
  technical_notes: string;
  confidence_score: number;
  missing_fields: string[];
  extraction_notes: string;
}

export interface ExtractionLog {
  id: string;
  fabric_id: string | null;
  source_image_path: string | null;
  raw_ai_response: string | null;
  extracted_json: ExtractionResult | null;
  confidence_score: number | null;
  extraction_status: 'success' | 'partial' | 'failed';
  error_message: string | null;
  created_at: string;
}

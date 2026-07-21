import type { FabricRepository } from '@/repositories/fabric.repository';
import type { ExtractionLogRepository } from '@/repositories/extraction-log.repository';
import type { AuditLogService } from '@/services/audit-log.service';
import type { AIExtractionService } from '@/features/ai-extraction/extraction.service';
import type { Fabric, FabricWithRelations, Paginated } from '@/types/fabric';
import type { FabricUpdateInput } from '@/features/fabrics/types/fabric.schema';

/** Human-in-the-loop review of low-confidence AI extractions. */
export class ReviewService {
  constructor(
    private readonly fabrics: FabricRepository,
    private readonly extractionLogs: ExtractionLogRepository,
    private readonly extraction: AIExtractionService,
    private readonly audit: AuditLogService,
  ) {}

  getQueue(page = 1, pageSize = 24): Promise<Paginated<FabricWithRelations>> {
    return this.fabrics.search({ reviewStatus: 'needs_review', sort: 'newest', page, pageSize });
  }

  async approve(fabricId: string, corrections: FabricUpdateInput, userId: string): Promise<Fabric> {
    const before = await this.fabrics.findById(fabricId);
    const fabric = await this.fabrics.update(fabricId, {
      ...corrections,
      review_status: 'approved',
    });
    await this.audit.record({
      user_id: userId,
      action: 'review.approve',
      entity_type: 'fabric',
      entity_id: fabricId,
      before_data: before,
      after_data: fabric,
    });
    return fabric;
  }

  async reject(fabricId: string, userId: string): Promise<Fabric> {
    const before = await this.fabrics.findById(fabricId);
    const fabric = await this.fabrics.update(fabricId, { review_status: 'rejected' });
    await this.audit.record({
      user_id: userId,
      action: 'review.reject',
      entity_type: 'fabric',
      entity_id: fabricId,
      before_data: before,
      after_data: fabric,
    });
    return fabric;
  }

  /** Re-run AI extraction against the fabric's primary image. */
  async rerunExtraction(fabricId: string, userId: string): Promise<Fabric> {
    const fabric = await this.fabrics.findById(fabricId);
    const primary = fabric.images.find((i) => i.is_primary) ?? fabric.images[0];
    if (!primary?.public_url) {
      throw new Error('Fabric has no image to extract from');
    }

    const outcome = await this.extraction.extractFromImageUrl(primary.public_url);
    const r = outcome.result;

    const updated = await this.fabrics.update(fabricId, {
      fabric_code: r.fabric_code || fabric.fabric_code,
      fabric_name: r.fabric_name || fabric.fabric_name,
      fabric_type: r.fabric_type || fabric.fabric_type,
      composition: r.composition || fabric.composition,
      gsm: r.gsm ?? fabric.gsm,
      width: r.width || fabric.width,
      color: r.color || fabric.color,
      color_family: r.color_family || fabric.color_family,
      season: r.season || fabric.season,
      suggested_use: r.suggested_use || fabric.suggested_use,
      extraction_confidence: r.confidence_score,
      review_status: outcome.needsReview ? 'needs_review' : 'approved',
    });

    await this.extractionLogs.insert({
      fabric_id: fabricId,
      source_image_path: primary.storage_path,
      raw_ai_response: outcome.raw,
      extracted_json: r,
      confidence_score: r.confidence_score,
      extraction_status: outcome.status,
    });

    await this.audit.record({
      user_id: userId,
      action: 'review.rerun_extraction',
      entity_type: 'fabric',
      entity_id: fabricId,
      after_data: updated,
    });

    return updated;
  }
}

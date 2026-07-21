import type { SupabaseClient } from '@supabase/supabase-js';
import { FabricRepository } from '@/repositories/fabric.repository';
import { MillRepository } from '@/repositories/mill.repository';
import { SimilarityRepository } from '@/repositories/similarity.repository';
import { ExtractionLogRepository } from '@/repositories/extraction-log.repository';
import { AuditLogRepository } from '@/repositories/audit-log.repository';
import { FabricService } from '@/services/fabric.service';
import { MillService } from '@/services/mill.service';
import { StorageService } from '@/services/storage.service';
import { SimilarityService } from '@/services/similarity.service';
import { ReviewService } from '@/services/review.service';
import { AuditLogService } from '@/services/audit-log.service';
import { AIExtractionService } from '@/features/ai-extraction/extraction.service';

/**
 * Composition root. Builds the service graph for a given Supabase client —
 * pass the user-scoped server client for normal requests (RLS enforced) or
 * the admin client for trusted automation endpoints.
 */
export function buildServices(db: SupabaseClient) {
  const fabricRepository = new FabricRepository(db);
  const millRepository = new MillRepository(db);
  const similarityRepository = new SimilarityRepository(db);
  const extractionLogRepository = new ExtractionLogRepository(db);
  const auditLogRepository = new AuditLogRepository(db);

  const auditLogService = new AuditLogService(auditLogRepository);
  const extractionService = new AIExtractionService();

  return {
    fabricService: new FabricService(fabricRepository, auditLogService),
    millService: new MillService(millRepository, fabricRepository),
    storageService: new StorageService(db),
    similarityService: new SimilarityService(fabricRepository, similarityRepository),
    reviewService: new ReviewService(
      fabricRepository,
      extractionLogRepository,
      extractionService,
      auditLogService,
    ),
    extractionService,
    auditLogService,
    repositories: {
      fabricRepository,
      millRepository,
      similarityRepository,
      extractionLogRepository,
      auditLogRepository,
    },
  };
}

export type Services = ReturnType<typeof buildServices>;

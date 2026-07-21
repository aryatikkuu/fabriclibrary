import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { NotFoundError } from '@/lib/errors';
import { formatDate } from '@/utils/format';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { FabricHero } from '@/components/fabrics/FabricHero';
import { FabricTechnicalData } from '@/components/fabrics/FabricTechnicalData';
import { SimilarFabrics } from '@/components/fabrics/SimilarFabrics';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';

export const dynamic = 'force-dynamic';

export default async function FabricDetailPage({ params }: { params: { id: string } }) {
  const db = await createClient();
  const services = buildServices(db);
  const profile = await getCurrentProfile();
  const isStaff = roleCan(profile?.role, 'review.read');

  let fabric;
  try {
    fabric = await services.fabricService.getById(params.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [similar, documents, extractionLogs] = await Promise.all([
    services.similarityService.getTopSimilar(fabric.id),
    db.from('fabric_documents').select('*').eq('fabric_id', fabric.id).then(({ data }) => data ?? []),
    isStaff ? services.repositories.extractionLogRepository.findByFabricId(fabric.id) : Promise.resolve([]),
  ]);

  const galleryImages = (fabric.images ?? []).filter((image) => !image.is_primary);

  return (
    <EditorialLayout>
      <div className="grid gap-12 pt-12 md:grid-cols-[55fr_45fr] md:gap-16">
        {/* Left — the fabric itself */}
        <div>
          <FabricHero fabric={fabric} />
          {galleryImages.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              {galleryImages.map((image) => (
                <div key={image.id} className="relative aspect-square overflow-hidden bg-linen">
                  {image.public_url && (
                    <Image
                      src={image.public_url}
                      alt={`${fabric.fabric_code} — ${image.image_type}`}
                      fill
                      sizes="15vw"
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — the record */}
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-label text-stone">
              {fabric.fabric_code}
            </span>
            {isStaff && <StatusBadge status={fabric.review_status} />}
            {isStaff && fabric.extraction_confidence != null && (
              <ConfidenceBadge score={fabric.extraction_confidence} />
            )}
          </div>

          <h1 className="mt-3 display-page">
            {fabric.fabric_name ?? 'Unnamed quality'}
          </h1>

          {(fabric.description || fabric.ai_description) && (
            <div className="mt-6 space-y-4 text-base leading-relaxed text-graphite">
              {fabric.description && <p>{fabric.description}</p>}
              {fabric.ai_description && (
                <p className="font-display italic">
                  {fabric.ai_description}
                  <span className="ml-2 font-mono text-[10px] not-italic uppercase tracking-label text-stone">
                    AI note
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="mt-10">
            <FabricTechnicalData fabric={fabric} />
          </div>

          {/* Documents */}
          {documents.length > 0 && (
            <div className="mt-10">
              <h2 className="border-b border-ink pb-2 font-display text-lg text-ink">Documents</h2>
              <ul className="mt-3 space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-baseline justify-between gap-4 border-b border-seam pb-2">
                    <a
                      href={doc.public_url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-ink underline decoration-seam underline-offset-4 hover:decoration-ink"
                    >
                      {doc.document_name}
                    </a>
                    <span className="font-mono text-[10px] uppercase tracking-label text-stone">
                      {doc.document_type}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Similar fabrics */}
      <SimilarFabrics items={similar} />

      {/* Extraction history — staff only */}
      {isStaff && extractionLogs.length > 0 && (
        <section className="mt-20">
          <div className="border-b border-ink pb-3">
            <h2 className="font-display text-2xl text-ink">Extraction history</h2>
          </div>
          <ul className="mt-6 space-y-3">
            {extractionLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-seam pb-3"
              >
                <span className="font-mono text-[11px] uppercase tracking-label text-stone">
                  {formatDate(log.created_at)}
                </span>
                <span className="text-sm text-graphite">
                  {log.extraction_status}
                  {log.confidence_score != null && ` · ${Math.round(log.confidence_score)}% confidence`}
                  {log.error_message && ` · ${log.error_message}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </EditorialLayout>
  );
}

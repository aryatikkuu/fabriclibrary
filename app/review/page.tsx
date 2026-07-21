import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { ReviewQueueTable } from '@/components/review/ReviewQueueTable';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Review queue' };

export default async function ReviewPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!roleCan(profile.role, 'review.read')) redirect('/');

  const services = buildServices(await createClient());
  const queue = await services.reviewService.getQueue();

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="Human in the loop"
        title="Review queue"
        description="Records where AI extraction confidence fell below the threshold. Correct the fields, then approve, re-run extraction, or reject."
        aside={
          <span className="font-mono text-[11px] uppercase tracking-label text-review">
            {queue.total} pending
          </span>
        }
      />
      <div className="mt-10">
        <ReviewQueueTable initialItems={queue.items} />
      </div>
    </EditorialLayout>
  );
}

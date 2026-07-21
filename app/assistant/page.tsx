import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { AssistantChat } from '@/components/search/AssistantChat';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Assistant' };

export default function AssistantPage() {
  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="AI search"
        title="Ask the archive"
        description="Describe the quality you need in plain language — weight, fibre, colour, mill — and the assistant translates it into a search."
      />
      <div className="mt-10 max-w-3xl">
        <AssistantChat />
      </div>
    </EditorialLayout>
  );
}

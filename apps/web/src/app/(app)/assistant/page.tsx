import { requireHousehold } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { Assistant } from '@/components/assistant';
export default async function AssistantPage() {
  const { household } = await requireHousehold();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Vores Kok AI" />
      <Assistant key={household.id} householdId={household.id} />
    </div>
  );
}

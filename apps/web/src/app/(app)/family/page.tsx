import { listPeople, searchRecipes } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import type { Metadata } from 'next';
import { PeopleManager } from '@/components/settings/people-manager';
import { PageHeader } from '@/components/ui';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Familie' };

export default async function FamilyPage() {
  const { db, household } = await requireHousehold();
  const people = await listPeople(db, household.id);
  const counts = Object.fromEntries(
    await Promise.all(people.map(async (p) => [p.id, (await searchRecipes(db, household.id, { person: p.id }, 1)).total] as const)),
  );
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Familien bag maden" subtitle="Personerne opskrifterne kommer fra — og historierne om dem." />
      <PeopleManager people={people} counts={counts} householdId={household.id} canEdit={can(household.role, 'people.edit')} canDelete={can(household.role, 'people.delete')} />
    </div>
  );
}

import { listCategories, listPeople } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import { redirect } from 'next/navigation';
import { requireHousehold } from '@/lib/session';
import { RecipeImport } from '@/components/recipe/recipe-import';
import { PageHeader } from '@/components/ui';
export const metadata = { title: 'Importér opskrifter' };
export default async function ImportPage() {
  const { db, household } = await requireHousehold();
  if (!can(household.role, 'recipe.create')) redirect('/recipes');
  const [categories, people] = await Promise.all([listCategories(db, household.id), listPeople(db, household.id)]);
  return <div className="mx-auto max-w-4xl"><PageHeader title="Importér opskrifter" /><RecipeImport householdId={household.id} categories={categories} people={people} /></div>;
}

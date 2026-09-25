import { listCategories, listPeople } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { emptyRecipe } from '@vores-kok/validation';
import { RecipeEditor } from '@/components/recipe/recipe-editor';
import { PageHeader } from '@/components/ui';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Ny opskrift' };

export default async function NewRecipePage() {
  const { db, household } = await requireHousehold();
  if (!can(household.role, 'recipe.create')) redirect('/recipes');
  const [categories, people] = await Promise.all([listCategories(db, household.id), listPeople(db, household.id)]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Ny opskrift" subtitle="Billeder, scannede originaler og historier tilføjer du, når opskriften er gemt." />
      <RecipeEditor mode="create" categories={categories} people={people} initial={emptyRecipe(household.id)} />
    </div>
  );
}

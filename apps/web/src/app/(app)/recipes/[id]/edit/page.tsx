import { getRecipe, listCategories, listPeople } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import { documentToInput } from '@vores-kok/validation';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RecipeEditor } from '@/components/recipe/recipe-editor';
import { PageHeader } from '@/components/ui';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Rediger opskrift' };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db, household } = await requireHousehold();
  const recipe = await getRecipe(db, id);
  if (!recipe) notFound();
  if (recipe.household_id !== household.id || !can(household.role, 'recipe.edit')) redirect(`/recipes/${id}`);
  const [categories, people] = await Promise.all([listCategories(db, household.id), listPeople(db, household.id)]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Rediger opskrift" eyebrow={recipe.title} subtitle="Den tidligere version gemmes automatisk i historikken." />
      <RecipeEditor mode="edit" categories={categories} people={people} initial={documentToInput(recipe)} />
    </div>
  );
}

import { getRecipe } from '@vores-kok/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CookMode } from '@/components/cook/cook-mode';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Kogetilstand' };

export default async function CookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ servings?: string }> }) {
  const { id } = await params;
  const { servings } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireHousehold();
  const recipe = await getRecipe(db, id);
  if (!recipe) notFound();
  const n = Number(servings);
  return <CookMode recipe={recipe} servings={Number.isInteger(n) && n > 0 && n <= 1000 ? n : recipe.servings} />;
}

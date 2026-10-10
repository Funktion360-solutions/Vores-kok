'use client';
import { useSyncExternalStore } from 'react';
import { type Category, type Person } from '@vores-kok/database';
import { aiDraftKey, parseAiRecipe } from '@/lib/ai-recipe-draft';
import { RecipeEditor } from './recipe-editor';

export function AiRecipeEditor({
  householdId,
  categories,
  people,
}: {
  householdId: string;
  categories: Category[];
  people: Person[];
}) {
  const answer = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem(aiDraftKey(householdId)) ?? '';
      } catch {
        return '';
      }
    },
    () => null,
  );
  if (answer === null) return <p>Åbner udkast…</p>;
  if (!answer)
    return (
      <p role="alert">Udkastet findes ikke i denne fane. Åbn et nyt udkast fra AI-assistenten.</p>
    );
  let draft;
  try {
    draft = parseAiRecipe(answer, householdId);
  } catch (e) {
    return <p role="alert">{e instanceof Error ? e.message : 'Udkastet kunne ikke åbnes.'}</p>;
  }
  return (
    <>
      <p className="mb-5 rounded-xl border p-4">
        AI-genereret udkast. Kontrollér alle felter, især portioner og tider. Intet er gemt endnu.
        Udkastets originaltekst bevares ved gemning.
      </p>
      <RecipeEditor mode="create" initial={draft} categories={categories} people={people} />
    </>
  );
}

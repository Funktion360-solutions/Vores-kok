import { useLocalSearchParams } from 'expo-router';
import { RecipeForm } from '@/components/recipe-form';
import { Empty } from '@/components/ui';
import { useCachedRecipes } from '@/lib/app-state';

export default function EditRecipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doc = useCachedRecipes().find((d) => d.id === id);
  return doc ? <RecipeForm recipe={doc} /> : <Empty title="Opskriften findes ikke" />;
}

import { getRecipe } from '@vores-kok/database';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { RecipeDetail } from '@/components/recipe-detail';
import { Empty } from '@/components/ui';
import { useApp, useCachedRecipes } from '@/lib/app-state';
import { supabase } from '@/lib/supabase';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cache, online } = useApp();
  const docs = useCachedRecipes();
  const doc = docs.find((d) => d.id === id);
  const [missing, setMissing] = useState(false);

  // Not cached yet (e.g. opened from a link): fetch once when online.
  useEffect(() => {
    if (doc || !online || !id) return;
    getRecipe(supabase, String(id)).then((d) => (d ? cache?.put(d) : setMissing(true))).catch(() => setMissing(true));
  }, [doc, online, id, cache]);

  if (!doc) {
    return missing || !online
      ? <View style={{ padding: 20 }}><Empty title="Opskriften findes ikke">{online ? 'Den er måske slettet, eller du har ikke adgang.' : 'Den er ikke gemt på enheden endnu.'}</Empty></View>
      : <ActivityIndicator style={{ marginTop: 40 }} />;
  }
  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <RecipeDetail recipe={doc} />
    </>
  );
}

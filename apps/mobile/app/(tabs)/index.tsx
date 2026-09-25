import { documentToSummary, filterRecipeDocuments } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { RecipeCard } from '@/components/recipe-card';
import { SyncStatus } from '@/components/sync-status';
import { Body, Button, Empty, Title } from '@/components/ui';
import { useApp, useCachedRecipes } from '@/lib/app-state';
import { useMediaSources } from '@/lib/media';
import { useLayout } from '@/lib/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 10 ? 'Godmorgen' : h < 12 ? 'God formiddag' : h < 18 ? 'God eftermiddag' : 'God aften';
}

export default function Home() {
  const { household, session, syncing, sync } = useApp();
  const docs = useCachedRecipes();
  const { isTablet } = useLayout();
  const favorites = useMemo(() => filterRecipeDocuments(docs, { favorites: true }).slice(0, 6).map(documentToSummary), [docs]);
  const family = useMemo(() => filterRecipeDocuments(docs, { family: true, sort: 'updated' }).slice(0, 6).map(documentToSummary), [docs]);
  const recent = useMemo(() => filterRecipeDocuments(docs, { sort: 'updated' }).slice(0, 6).map(documentToSummary), [docs]);
  const source = useMediaSources([...favorites, ...family, ...recent].map((r) => r.cover_path));
  const name = (session?.user.user_metadata?.display_name as string | undefined)?.split(' ')[0] ?? '';

  const shelf = (title: string, list: typeof recent) => list.length ? (
    <View style={{ gap: 10 }}>
      <Title size="lg">{title}</Title>
      <View style={{ flexDirection: isTablet ? 'row' : 'column', flexWrap: 'wrap', gap: 10 }}>
        {list.map((r) => (
          <View key={r.id} style={{ width: isTablet ? '48.5%' : '100%' }}>
            <RecipeCard recipe={r} source={source(r.cover_path)} onPress={() => router.push(`/recipe/${r.id}`)} />
          </View>
        ))}
      </View>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <SyncStatus />
      <ScrollView refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />} contentContainerStyle={{ padding: 20, gap: 24, maxWidth: 1100, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 4 }}>
          <Body muted>{household?.name}</Body>
          <Title size="display">{greeting()}{name ? `, ${name}` : ''}</Title>
          <Body muted>{docs.length} {docs.length === 1 ? 'opskrift' : 'opskrifter'} i jeres kogebog</Body>
        </View>
        {can(household?.role, 'recipe.create') ? <Button icon="add" title="Ny opskrift" onPress={() => router.push('/recipe/new')} style={{ alignSelf: 'flex-start' }} /> : null}
        {docs.length === 0 && !syncing ? <Empty title="Kogebogen er tom">Tilføj familiens første opskrift — eller flyt dem over fra Mors Opskrifter.</Empty> : null}
        {shelf('Dine favoritter', favorites)}
        {shelf('Fra familien', family)}
        {shelf('Senest ændret', recent)}
      </ScrollView>
    </View>
  );
}

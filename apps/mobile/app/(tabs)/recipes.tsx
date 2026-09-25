import { documentToSummary, filterRecipeDocuments } from '@vores-kok/database';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '@vores-kok/domain';
import type { RecipeFilters } from '@vores-kok/validation';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { RecipeCard } from '@/components/recipe-card';
import { RecipeDetail } from '@/components/recipe-detail';
import { SyncStatus } from '@/components/sync-status';
import { Body, Chip, Empty } from '@/components/ui';
import { useApp, useCachedRecipes } from '@/lib/app-state';
import { useMediaSources } from '@/lib/media';
import { useLayout, useTheme } from '@/lib/theme';

export default function Recipes() {
  const { c, touchTarget } = useTheme();
  const { isTablet, landscape } = useLayout();
  const { categories, syncing, sync } = useApp();
  const docs = useCachedRecipes();
  const [f, setF] = useState<RecipeFilters>({});
  const [selected, setSelected] = useState<string | null>(null);
  const results = useMemo(() => filterRecipeDocuments(docs, f), [docs, f]);
  const rows = useMemo(() => results.map(documentToSummary), [results]);
  const source = useMediaSources(rows.slice(0, 60).map((r) => r.cover_path));
  const split = isTablet && landscape;
  const selectedDoc = split && selected ? docs.find((d) => d.id === selected) : undefined;
  const toggle = <T,>(list: T[] | undefined, v: T) => { const n = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]; return n.length ? n : undefined; };

  const list = (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, gap: 10 }}>
        <TextInput accessibilityLabel="Søg i opskrifter" placeholder="Søg efter titel, ingrediens, person…" placeholderTextColor={c.inkMuted}
          value={f.q ?? ''} onChangeText={(q) => setF((x) => ({ ...x, q: q || undefined }))} clearButtonMode="while-editing" returnKeyType="search"
          style={{ minHeight: touchTarget, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, paddingHorizontal: 18, fontSize: 16, color: c.ink }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="★ Favoritter" active={!!f.favorites} onPress={() => setF((x) => ({ ...x, favorites: x.favorites ? undefined : true }))} />
          <Chip label="♥ Familie" active={!!f.family} onPress={() => setF((x) => ({ ...x, family: x.family ? undefined : true }))} />
          <Chip label="≤ 30 min" active={f.maxTime === 30} onPress={() => setF((x) => ({ ...x, maxTime: x.maxTime === 30 ? undefined : 30 }))} />
          {DIFFICULTIES.map((d) => <Chip key={d} label={DIFFICULTY_LABELS[d]} active={!!f.difficulty?.includes(d)} onPress={() => setF((x) => ({ ...x, difficulty: toggle(x.difficulty, d) }))} />)}
          {categories.map((cat) => <Chip key={cat.id} label={cat.name} active={!!f.category?.includes(cat.id)} onPress={() => setF((x) => ({ ...x, category: toggle(x.category, cat.id) }))} />)}
        </ScrollView>
        <Body muted size="sm">{rows.length} {rows.length === 1 ? 'opskrift' : 'opskrifter'}</Body>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />}
        ListEmptyComponent={<Empty title={docs.length ? 'Ingen match' : 'Ingen opskrifter endnu'}>{docs.length ? 'Prøv et andet søgeord eller færre filtre.' : 'Træk ned for at hente.'}</Empty>}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} source={source(item.cover_path)} compact={split} selected={split && item.id === selected}
            onPress={() => (split ? setSelected(item.id) : router.push(`/recipe/${item.id}`))} />
        )}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <SyncStatus />
      {split ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 380, borderRightWidth: 1, borderRightColor: c.line }}>{list}</View>
          <View style={{ flex: 1 }}>
            {selectedDoc ? <RecipeDetail key={selectedDoc.id} recipe={selectedDoc} onClose={() => setSelected(null)} /> : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}><Body muted>Vælg en opskrift til venstre.</Body></View>
            )}
          </View>
        </View>
      ) : list}
    </View>
  );
}

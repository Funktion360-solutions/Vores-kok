import { Ionicons } from '@expo/vector-icons';
import { addMediaRow, addNote, getRecipe, saveStory, toDataError } from '@vores-kok/database';
import {
  buildMediaPath, can, DIFFICULTY_LABELS, formatAmount, formatDate, formatMinutes, formatYear, formatYield, MEDIA_BUCKET, MEDIA_KIND_LABELS,
  scaleFactor, scaleQuantity, SOURCE_TYPE_LABELS, totalMinutes, type MediaKind,
} from '@vores-kok/domain';
import type { RecipeDocument } from '@vores-kok/validation';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useApp } from '@/lib/app-state';
import { useMediaSources } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { fonts, useLayout, useTheme } from '@/lib/theme';
import { Banner, Body, Button, Card, Chip, Field, IconButton, Title } from './ui';

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title size="lg">{title}</Title>
        {right}
      </View>
      {children}
    </View>
  );
}

function Ingredients({ recipe }: { recipe: RecipeDocument }) {
  const { c } = useTheme();
  const [target, setTarget] = useState(recipe.servings ?? 0);
  useEffect(() => setTarget(recipe.servings ?? 0), [recipe.servings]);
  const factor = scaleFactor(recipe.servings, target);
  const step = recipe.servings && recipe.servings >= 12 ? Math.max(1, Math.round(recipe.servings / 4)) : 1;
  let lastSection: string | null = null;
  return (
    <Section title="Ingredienser">
      {recipe.servings ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderColor: c.line, borderRadius: 999, backgroundColor: c.paper }}>
            <IconButton icon="remove" label="Færre portioner" onPress={() => setTarget((t) => Math.max(1, t - step))} />
            <Text accessibilityLiveRegion="polite" style={{ minWidth: 110, textAlign: 'center', fontSize: 17, fontWeight: '600', color: c.ink }}>{formatYield(target, recipe.yield_unit)}</Text>
            <IconButton icon="add" label="Flere portioner" onPress={() => setTarget((t) => Math.min(1000, t + step))} />
          </View>
          {recipe.servings <= 12 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[2, 4, 6, 8].map((n) => <Chip key={n} label={`${n}`} active={target === n} onPress={() => setTarget(n)} />)}
              {target !== recipe.servings ? <Chip label={`Original (${recipe.servings})`} onPress={() => setTarget(recipe.servings!)} /> : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {recipe.ingredients.length === 0 ? <Body muted>Ingen ingredienser endnu.</Body> : null}
      <View>
        {recipe.ingredients.map((i) => {
          const s = scaleQuantity({ quantity: i.quantity, quantityMax: i.quantity_max, unit: i.unit, unitCode: i.unit_code, isScalable: i.is_scalable }, factor);
          const header = i.section && i.section !== lastSection ? i.section : null;
          lastSection = i.section;
          return (
            <View key={i.id}>
              {header ? <Text style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: c.inkSoft, marginTop: 12, marginBottom: 4 }}>{header}</Text> : null}
              <View style={{ flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line, gap: 12 }}
                accessible accessibilityLabel={`${formatAmount(s)} ${i.name}${i.preparation ? `, ${i.preparation}` : ''}`}>
                <Text style={{ width: 92, textAlign: 'right', fontWeight: '700', fontSize: 17, color: s.scaled ? c.terracottaDark : c.ink }}>{formatAmount(s)}</Text>
                <Text style={{ flex: 1, fontSize: 17, color: c.ink }}>{i.name}{i.preparation ? <Text style={{ color: c.inkSoft }}>, {i.preparation}</Text> : null}{i.is_optional ? <Text style={{ color: c.inkMuted }}> (valgfri)</Text> : null}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function Steps({ recipe }: { recipe: RecipeDocument }) {
  const { c } = useTheme();
  return (
    <Section title="Fremgangsmåde">
      {recipe.steps.length === 0 ? <Body muted>Ingen trin endnu.</Body> : null}
      {recipe.steps.map((s, idx) => (
        <View key={s.id} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.terracottaSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontWeight: '700', color: c.terracottaDark }}>{idx + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Body size="lg">{s.body}</Body>
            {s.timer_seconds ? <Body muted size="sm">⏱ {formatMinutes(Math.round(s.timer_seconds / 60))}</Body> : null}
          </View>
        </View>
      ))}
      {recipe.notes ? (
        <View style={{ backgroundColor: c.honeySoft, borderLeftWidth: 4, borderLeftColor: c.honey, borderRadius: 12, padding: 14 }}>
          <Text style={{ fontFamily: fonts.display, fontWeight: '700', fontSize: 16, color: c.ink, marginBottom: 4 }}>Gode råd</Text>
          <Body>{recipe.notes}</Body>
        </View>
      ) : null}
    </Section>
  );
}

async function pickAndUpload(recipe: RecipeDocument, kind: MediaKind, camera: boolean) {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { Alert.alert('Adgang nægtet', 'Giv Vores Kok adgang i Indstillinger for at tilføje billeder.'); return false; }
  const res = camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: false });
  if (res.canceled || !res.assets[0]) return false;
  const a = res.assets[0];
  // Re-encode: resizes and drops EXIF/GPS metadata before anything leaves the device.
  const edge = 2560;
  const resize = a.width && a.height && Math.max(a.width, a.height) > edge ? [{ resize: a.width >= a.height ? { width: edge } : { height: edge } }] : [];
  const out = await ImageManipulator.manipulateAsync(a.uri, resize, { compress: 0.86, format: ImageManipulator.SaveFormat.JPEG });
  const body = await (await fetch(out.uri)).arrayBuffer();
  const path = buildMediaPath(recipe.household_id, 'recipes', recipe.id, Crypto.randomUUID(), 'image/jpeg');
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
  await addMediaRow(supabase, {
    recipe_id: recipe.id, household_id: recipe.household_id, storage_path: path, mime_type: 'image/jpeg', kind,
    byte_size: body.byteLength, width: out.width, height: out.height, is_cover: kind === 'photo' && !recipe.media.some((m) => m.is_cover),
  });
  return true;
}

export function RecipeDetail({ recipe, onClose }: { recipe: RecipeDocument; onClose?: () => void }) {
  const { c } = useTheme();
  const { isTablet, landscape, isWide } = useLayout();
  const { cache, household, online, session } = useApp();
  const role = household?.id === recipe.household_id ? household.role : null;
  const canEdit = can(role, 'recipe.edit');
  const source = useMediaSources(recipe.media.map((m) => m.storage_path));
  const cover = recipe.media.find((m) => m.is_cover && m.mime_type.startsWith('image/')) ?? recipe.media.find((m) => m.kind === 'photo' && m.mime_type.startsWith('image/'));
  const heritage = recipe.media.filter((m) => m.kind === 'original_scan' || m.kind === 'historical_photo');
  const photos = recipe.media.filter((m) => m.kind === 'photo');
  const [busy, setBusy] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [story, setStory] = useState({ body: '', year: '' });
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const origin = recipe.origin_person?.name ?? recipe.origin_text;
  const total = totalMinutes(recipe);

  // Refresh the document when online (notes, media and edits by others).
  useEffect(() => {
    if (!online) return;
    getRecipe(supabase, recipe.id).then((d) => { if (d) void cache?.put(d); else void cache?.remove(recipe.id); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.id, online]);

  const refresh = async () => { const d = await getRecipe(supabase, recipe.id); if (d) await cache?.put(d); };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await refresh(); } catch (e) { setError(toDataError(e).message); } finally { setBusy(false); }
  };

  const sideBySide = isTablet && (landscape || isWide);
  const meta = useMemo(() => [
    recipe.prep_minutes != null ? `Forberedelse ${formatMinutes(recipe.prep_minutes)}` : null,
    recipe.cook_minutes != null ? `Tilberedning ${formatMinutes(recipe.cook_minutes)}` : null,
    total ? `I alt ${formatMinutes(total)}` : null,
    recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty] : null,
  ].filter(Boolean) as string[], [recipe, total]);

  const gallery = (items: typeof recipe.media) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {items.map((m) => (
        <View key={m.id} style={{ width: 150 }}>
          {source(m.storage_path) ? <Image source={source(m.storage_path)} style={{ width: 150, height: 150, borderRadius: 12, backgroundColor: c.sand }} contentFit="cover" accessibilityLabel={m.caption ?? MEDIA_KIND_LABELS[m.kind]} />
            : <View style={{ width: 150, height: 150, borderRadius: 12, backgroundColor: c.sand }} />}
          <Body size="xs" muted numberOfLines={2}>{MEDIA_KIND_LABELS[m.kind]}{m.approx_year ? ` · ca. ${m.approx_year}` : ''}{m.caption ? ` — ${m.caption}` : ''}</Body>
        </View>
      ))}
    </ScrollView>
  );

  const addButtons = (kind: MediaKind) => canEdit && online ? (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="secondary" icon="camera-outline" title="Tag billede" disabled={busy} onPress={() => run(() => pickAndUpload(recipe, kind, true))} />
      <Button variant="ghost" icon="images-outline" title="Vælg billede" disabled={busy} onPress={() => run(() => pickAndUpload(recipe, kind, false))} />
    </View>
  ) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 60, maxWidth: 1100, width: '100%', alignSelf: 'center' }}>
      {onClose ? <View style={{ alignItems: 'flex-end', marginBottom: -20 }}><IconButton icon="close" label="Luk opskrift" onPress={onClose} /></View> : null}
      <View style={{ gap: 16, flexDirection: sideBySide ? 'row-reverse' : 'column' }}>
        <View style={{ flex: sideBySide ? 1 : undefined }}>
          {cover && source(cover.storage_path) ? (
            <Image source={source(cover.storage_path)} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 20, backgroundColor: c.sand }} contentFit="cover" accessibilityLabel={recipe.title} />
          ) : (
            <View style={{ width: '100%', aspectRatio: sideBySide ? 4 / 3 : 16 / 7, borderRadius: 20, backgroundColor: c.honeySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="restaurant-outline" size={48} color={c.terracotta} />
            </View>
          )}
        </View>
        <View style={{ flex: sideBySide ? 1.2 : undefined, gap: 10, justifyContent: 'center' }}>
          {recipe.category ? <Text style={{ color: c.inkMuted, textTransform: 'uppercase', fontSize: 13, letterSpacing: 0.5 }}>{recipe.category.name}</Text> : null}
          <Title size="display">{recipe.title}</Title>
          {origin ? <Text style={{ color: c.sage, fontSize: 17 }}>♥ Fra {origin}{recipe.origin_year ? ` · ${formatYear(recipe.origin_year, recipe.origin_year_approx)}` : ''}</Text> : null}
          {recipe.description ? <Body size="lg" muted>{recipe.description}</Body> : null}
          {meta.length ? <Body muted size="sm">{meta.join('  ·  ')}</Body> : null}
          {recipe.servings ? <Body muted size="sm">{formatYield(recipe.servings, recipe.yield_unit)}</Body> : null}
          {recipe.tags.length ? <Body muted size="sm">{recipe.tags.map((t) => `#${t.name}`).join('  ')}</Body> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {role ? <Button variant={recipe.is_favorite ? 'soft' : 'secondary'} icon={recipe.is_favorite ? 'star' : 'star-outline'} title={recipe.is_favorite ? 'Favorit' : 'Gem som favorit'}
              onPress={() => void cache?.setFavorite(recipe.id, !recipe.is_favorite)} /> : null}
            {canEdit ? <Button icon="create-outline" title="Rediger" disabled={!online} onPress={() => router.push(`/recipe/${recipe.id}/edit`)} /> : null}
          </View>
          {canEdit && !online ? <Body muted size="xs">Redigering kræver forbindelse.</Body> : null}
        </View>
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: 28, alignItems: 'flex-start' }}>
        <Card style={{ width: sideBySide ? 380 : '100%' }}><Ingredients recipe={recipe} /></Card>
        <View style={{ flex: sideBySide ? 1 : undefined, width: sideBySide ? undefined : '100%' }}><Steps recipe={recipe} /></View>
      </View>

      <Section title="Historien bag" right={canEdit && online && !storyOpen ? <Button variant="soft" icon="add" title="Tilføj" onPress={() => setStoryOpen(true)} /> : null}>
        {storyOpen ? (
          <Card style={{ gap: 12 }}>
            <Field label="Historien" multiline value={story.body} onChangeText={(v) => setStory((s) => ({ ...s, body: v }))} placeholder="Hvem lavede den, og hvad husker I?" />
            <Field label="Cirka år" keyboardType="number-pad" value={story.year} onChangeText={(v) => setStory((s) => ({ ...s, year: v.replace(/\D/g, '').slice(0, 4) }))} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Gem historie" loading={busy} disabled={!story.body.trim()} onPress={() => run(async () => {
                await saveStory(supabase, { recipe_id: recipe.id, household_id: recipe.household_id, body: story.body.trim(), approx_year: story.year ? Number(story.year) : null });
                setStory({ body: '', year: '' }); setStoryOpen(false);
              })} />
              <Button variant="ghost" title="Annullér" onPress={() => setStoryOpen(false)} />
            </View>
          </Card>
        ) : null}
        {recipe.stories.length === 0 && !storyOpen ? <Body muted>Der er endnu ingen historie om denne opskrift.</Body> : null}
        {recipe.stories.map((s) => (
          <View key={s.id} style={{ backgroundColor: c.honeySoft, borderRadius: 16, padding: 16, gap: 6 }}>
            {s.title ? <Text style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: c.ink }}>{s.title}</Text> : null}
            <Text style={{ fontFamily: fonts.display, fontSize: 17, lineHeight: 26, color: c.ink }}>{s.body}</Text>
            <Body muted size="sm">{[s.person_name && `Om ${s.person_name}`, s.told_by && `Fortalt af ${s.told_by}`, s.approx_year && `ca. ${s.approx_year}`].filter(Boolean).join(' · ')}</Body>
          </View>
        ))}
      </Section>

      <Section title="Originaler og gamle billeder">
        {heritage.length ? gallery(heritage) : <Body muted>Ingen scannede originaler endnu.</Body>}
        {addButtons('original_scan')}
      </Section>

      <Section title="Billeder af retten">
        {photos.length ? gallery(photos) : <Body muted>Ingen billeder endnu.</Body>}
        {addButtons('photo')}
      </Section>

      <Section title="Noter">
        {recipe.notes_personal.map((n) => (
          <Card key={n.id} style={{ gap: 4 }}>
            <Body>{n.body}</Body>
            <Body muted size="xs">{n.visibility === 'private' ? '🔒 Kun dig' : `👪 ${n.author_name ?? ''}`} · {formatDate(n.created_at)}</Body>
          </Card>
        ))}
        {online && role ? (
          <View style={{ gap: 8 }}>
            <Field label="Ny privat note" multiline value={note} onChangeText={setNote} placeholder="Fx “brug lidt mindre sukker”" />
            <Button variant="secondary" title="Gem note" disabled={!note.trim() || busy} onPress={() => run(async () => {
              await addNote(supabase, { recipe_id: recipe.id, household_id: recipe.household_id, user_id: session!.user.id, body: note.trim(), visibility: 'private' });
              setNote('');
            })} />
          </View>
        ) : null}
      </Section>

      <Section title="Oprindelse">
        <Body muted size="sm">Kilde: {SOURCE_TYPE_LABELS[recipe.source_type]}{recipe.source_name ? ` · ${recipe.source_name}` : ''}</Body>
        {recipe.legacy_author ? <Body muted size="sm">Forfatter: {recipe.legacy_author}</Body> : null}
        <Body muted size="sm">Tilføjet {formatDate(recipe.created_at)}{recipe.created_by_name ? ` af ${recipe.created_by_name}` : ''}</Body>
        <Body muted size="sm">Senest ændret {formatDate(recipe.updated_at)}{recipe.updated_by_name ? ` af ${recipe.updated_by_name}` : ''} · version {recipe.version}</Body>
        {recipe.source_text ? <Pressable onPress={() => Alert.alert('Original tekst', recipe.source_text ?? '')}><Text style={{ color: c.terracotta }}>Vis original tekst</Text></Pressable> : null}
      </Section>
    </ScrollView>
  );
}

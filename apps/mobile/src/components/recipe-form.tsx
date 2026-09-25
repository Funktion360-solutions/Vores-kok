import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRecipe, saveCategory, saveRecipe, toDataError } from '@vores-kok/database';
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '@vores-kok/domain';
import type { RecipeDocument, RecipeInput } from '@vores-kok/validation';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useApp } from '@/lib/app-state';
import { ingredientsToText, linesToIngredients } from '@/lib/ingredient-lines';
import { supabase } from '@/lib/supabase';
import { Banner, Body, Button, Chip, Field, Title } from './ui';

interface FormState {
  title: string; description: string; categoryId: string | null; servings: string; yieldUnit: string;
  prep: string; cook: string; total: string; difficulty: Difficulty | null; ingredients: string; steps: string;
  notes: string; personId: string | null; originText: string; originYear: string; tags: string;
}

function fromDoc(d?: RecipeDocument): FormState {
  return {
    title: d?.title ?? '', description: d?.description ?? '', categoryId: d?.category_id ?? null,
    servings: d?.servings ? String(d.servings) : '', yieldUnit: d?.yield_unit ?? '',
    prep: d?.prep_minutes != null ? String(d.prep_minutes) : '', cook: d?.cook_minutes != null ? String(d.cook_minutes) : '',
    total: d?.total_minutes != null ? String(d.total_minutes) : '', difficulty: d?.difficulty ?? null,
    ingredients: d ? ingredientsToText(d.ingredients) : '', steps: d ? d.steps.map((s) => s.body).join('\n\n') : '',
    notes: d?.notes ?? '', personId: d?.origin_person_id ?? null, originText: d?.origin_text ?? '',
    originYear: d?.origin_year ? String(d.origin_year) : '', tags: d ? d.tags.map((t) => t.name).join(', ') : '',
  };
}

export function RecipeForm({ recipe }: { recipe?: RecipeDocument }) {
  const { household, categories, people, online, cache, refreshReference } = useApp();
  const draftKey = `vk:v1:draft:${recipe?.id ?? `new:${household?.id}`}`;
  const [f, setF] = useState<FormState>(() => fromDoc(recipe));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [newCat, setNewCat] = useState('');
  const loaded = useRef(false);

  // Restore an unsaved local draft (e.g. after losing connection or closing the app).
  useEffect(() => {
    AsyncStorage.getItem(draftKey).then((raw) => {
      if (raw) { setF(JSON.parse(raw) as FormState); setRestored(true); }
      loaded.current = true;
    });
  }, [draftKey]);
  useEffect(() => { if (loaded.current) void AsyncStorage.setItem(draftKey, JSON.stringify(f)); }, [f, draftKey]);

  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));
  const num = (v: string) => v.replace(/\D/g, '');

  async function onSave() {
    if (!household) return;
    setSaving(true);
    setError(null);
    try {
      const steps = f.steps.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      const existingSteps = recipe?.steps ?? [];
      const input: RecipeInput = {
        id: recipe?.id, household_id: recipe?.household_id ?? household.id, expected_version: recipe?.version ?? null,
        title: f.title, description: f.description, category_id: f.categoryId, servings: f.servings as unknown as number, yield_unit: f.yieldUnit,
        prep_minutes: f.prep as unknown as number, cook_minutes: f.cook as unknown as number, total_minutes: f.total as unknown as number,
        difficulty: f.difficulty, notes: f.notes, meal_types: (recipe?.meal_types ?? []) as RecipeInput['meal_types'],
        source_type: recipe?.source_type ?? 'manual', source_name: recipe?.source_name, source_url: recipe?.source_url,
        origin_person_id: f.personId, origin_text: f.originText, origin_year: f.originYear as unknown as number, origin_year_approx: recipe?.origin_year_approx ?? true,
        ingredients: linesToIngredients(f.ingredients, recipe?.ingredients ?? []),
        steps: steps.map((body) => ({ id: existingSteps.find((s) => s.body === body)?.id, body, timer_seconds: existingSteps.find((s) => s.body === body)?.timer_seconds ?? null })),
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const res = await saveRecipe(supabase, input);
      const doc = await getRecipe(supabase, res.id);
      if (doc) await cache?.put(doc);
      await AsyncStorage.removeItem(draftKey);
      router.replace(`/recipe/${res.id}`);
    } catch (e) {
      const err = toDataError(e);
      setError(err.isConflict ? `${err.message} Din kladde er gemt på enheden.` : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 80, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        {!online ? <Banner>Du er offline. Dine ændringer gemmes som kladde på enheden og kan gemmes, når du er online igen.</Banner> : null}
        {restored ? <Banner tone="success">Din ikke-gemte kladde er gendannet.</Banner> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Field label="Titel" value={f.title} onChangeText={(v) => set({ title: v })} placeholder="Fx Oldemors æblekage" maxLength={200} />
        <Field label="Kort beskrivelse" value={f.description} onChangeText={(v) => set({ description: v })} multiline />
        <View style={{ gap: 8 }}>
          <Body size="sm" style={{ fontWeight: '600' }}>Kategori</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Ingen" active={!f.categoryId} onPress={() => set({ categoryId: null })} />
            {categories.map((c) => <Chip key={c.id} label={c.name} active={f.categoryId === c.id} onPress={() => set({ categoryId: c.id })} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label="Ny kategori" value={newCat} onChangeText={setNewCat} /></View>
            <Button variant="secondary" title="Opret" disabled={!newCat.trim() || !online} onPress={async () => {
              try { const c = await saveCategory(supabase, { household_id: household!.id, name: newCat.trim() }); await refreshReference(); set({ categoryId: c.id }); setNewCat(''); }
              catch (e) { setError(toDataError(e).message); }
            }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Portioner" keyboardType="number-pad" value={f.servings} onChangeText={(v) => set({ servings: num(v) })} /></View>
          <View style={{ flex: 1 }}><Field label="Enhed" value={f.yieldUnit} onChangeText={(v) => set({ yieldUnit: v })} placeholder="personer" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Forb. (min)" keyboardType="number-pad" value={f.prep} onChangeText={(v) => set({ prep: num(v) })} /></View>
          <View style={{ flex: 1 }}><Field label="Tilb. (min)" keyboardType="number-pad" value={f.cook} onChangeText={(v) => set({ cook: num(v) })} /></View>
          <View style={{ flex: 1 }}><Field label="I alt (min)" keyboardType="number-pad" value={f.total} onChangeText={(v) => set({ total: num(v) })} /></View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DIFFICULTIES.map((d) => <Chip key={d} label={DIFFICULTY_LABELS[d]} active={f.difficulty === d} onPress={() => set({ difficulty: f.difficulty === d ? null : d })} />)}
        </View>
        <Title size="lg">Ingredienser</Title>
        <Field label="Én ingrediens pr. linje" hint="Fx “2½ dl hvedemel”. En linje der ender med kolon bliver en sektion. Utraditionelle mængder gemmes som skrevet."
          value={f.ingredients} onChangeText={(v) => set({ ingredients: v })} multiline style={{ minHeight: 180 }} autoCapitalize="none" />
        <Title size="lg">Fremgangsmåde</Title>
        <Field label="Trin — adskil med en tom linje" value={f.steps} onChangeText={(v) => set({ steps: v })} multiline style={{ minHeight: 180 }} />
        <Field label="Gode råd og noter" value={f.notes} onChangeText={(v) => set({ notes: v })} multiline />
        <Title size="lg">Familiehistorie</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Ingen person" active={!f.personId} onPress={() => set({ personId: null })} />
          {people.map((p) => <Chip key={p.id} label={p.name} active={f.personId === p.id} onPress={() => set({ personId: p.id })} />)}
        </View>
        <Field label="Oprindelse (tekst)" value={f.originText} onChangeText={(v) => set({ originText: v })} placeholder="Fx Mormor Karen fra Vejle" />
        <Field label="Cirka år" keyboardType="number-pad" value={f.originYear} onChangeText={(v) => set({ originYear: num(v).slice(0, 4) })} />
        <Field label="Tags (komma-separeret)" value={f.tags} onChangeText={(v) => set({ tags: v })} autoCapitalize="none" />
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" title="Kassér kladde" onPress={async () => { await AsyncStorage.removeItem(draftKey); setF(fromDoc(recipe)); setRestored(false); }} />
          <Button title={recipe ? 'Gem ændringer' : 'Opret opskrift'} loading={saving} disabled={!online || !f.title.trim()} onPress={onSave} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

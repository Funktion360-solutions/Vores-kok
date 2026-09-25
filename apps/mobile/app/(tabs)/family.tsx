import { savePerson, toDataError } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Banner, Body, Button, Card, Empty, Field, Title } from '@/components/ui';
import { useApp, useCachedRecipes } from '@/lib/app-state';
import { supabase } from '@/lib/supabase';
import { useLayout } from '@/lib/theme';

export default function Family() {
  const { people, household, online, refreshReference } = useApp();
  const docs = useCachedRecipes();
  const { isTablet } = useLayout();
  const [form, setForm] = useState({ name: '', relation: '' });
  const [error, setError] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of docs) {
      const ids = new Set([d.origin_person_id, ...d.stories.map((s) => s.person_id)].filter(Boolean) as string[]);
      for (const p of ids) m.set(p, [...(m.get(p) ?? []), d.title]);
    }
    return m;
  }, [docs]);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 1000, width: '100%', alignSelf: 'center' }}>
      <Title size="xxl">Familien bag maden</Title>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {people.length === 0 ? <Empty title="Ingen personer endnu">Tilføj fx oldemor eller farfar, og knyt deres opskrifter til dem.</Empty> : null}
      <View style={{ flexDirection: isTablet ? 'row' : 'column', flexWrap: 'wrap', gap: 12 }}>
        {people.map((p) => (
          <Card key={p.id} style={{ width: isTablet ? '48.5%' : '100%', gap: 4 }}>
            <Title size="lg">{p.name}</Title>
            <Body muted size="sm">{[p.relation, p.birth_year ? `${p.birth_year}${p.death_year ? `–${p.death_year}` : ''}` : null].filter(Boolean).join(' · ')}</Body>
            {p.bio ? <Body numberOfLines={4}>{p.bio}</Body> : null}
            <Body muted size="sm">{(counts.get(p.id) ?? []).join(', ') || 'Ingen opskrifter endnu'}</Body>
          </Card>
        ))}
      </View>
      {can(household?.role, 'people.edit') && online ? (
        <Card style={{ gap: 12 }}>
          <Title size="lg">Tilføj person</Title>
          <Field label="Navn" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Relation" value={form.relation} onChangeText={(v) => setForm((f) => ({ ...f, relation: v }))} placeholder="Fx Oldemor" />
          <Button title="Tilføj" disabled={!form.name.trim()} onPress={async () => {
            try { await savePerson(supabase, { household_id: household!.id, name: form.name.trim(), relation: form.relation.trim() || null }); setForm({ name: '', relation: '' }); await refreshReference(); }
            catch (e) { setError(toDataError(e).message); }
          }} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

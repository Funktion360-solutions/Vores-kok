import { acceptInvite, createHousehold, toDataError } from '@vores-kok/database';
import { householdNameSchema, inviteTokenSchema } from '@vores-kok/validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Banner, Body, Button, Card, Field, Title } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { supabase } from '@/lib/supabase';

export const extractToken = (v: string) => (/\/invite\/([A-Za-z0-9_-]+)/.exec(v)?.[1] ?? v).trim();

export default function Onboarding() {
  const { refreshHouseholds, switchHousehold, signOut } = useApp();
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = async (id: string) => { await refreshHouseholds(); await switchHousehold(id); router.replace('/'); };
  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setError(null);
    try { await done(await fn()); } catch (e) { setError(toDataError(e).message); } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Title size="xxl">Jeres fælles kogebog</Title>
      <Body muted>Opret en husstand, eller tilslut dig familiens med en invitation.</Body>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card style={{ gap: 12 }}>
        <Title size="lg">Opret en husstand</Title>
        <Field label="Navn" value={name} onChangeText={setName} placeholder="Fx Familien Slot" />
        <Button title="Opret husstand" loading={busy} onPress={() => {
          const p = householdNameSchema.safeParse(name);
          if (!p.success) return setError(p.error.issues[0]?.message ?? '');
          void run(() => createHousehold(supabase, p.data));
        }} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Title size="lg">Tilslut med invitation</Title>
        <Field label="Invitationslink eller kode" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
        <Button variant="secondary" title="Tilslut" loading={busy} onPress={() => {
          const p = inviteTokenSchema.safeParse(extractToken(token));
          if (!p.success) return setError('Invitationskoden ser ikke rigtig ud.');
          void run(() => acceptInvite(supabase, p.data));
        }} />
      </Card>
      <View><Button variant="ghost" title="Log ud" onPress={() => void signOut()} /></View>
    </ScrollView>
  );
}

import { createInvite, toDataError, updateMyProfile } from '@vores-kok/database';
import { can, formatDate, ROLE_LABELS } from '@vores-kok/domain';
import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { Banner, Body, Button, Card, Chip, Field, Title } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { supabase } from '@/lib/supabase';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://voreskok.dk';

export default function More() {
  const { session, households, household, switchHousehold, signOut, online, cache, sync, syncing } = useApp();
  const [name, setName] = useState((session?.user.user_metadata?.display_name as string | undefined) ?? '');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <Title size="xxl">Mere</Title>
      {msg ? <Banner tone={msg.tone}>{msg.text}</Banner> : null}
      <Card style={{ gap: 12 }}>
        <Title size="lg">Husstand</Title>
        <Body muted>{household?.name} · din rolle: {household ? ROLE_LABELS[household.role] : ''}</Body>
        {households.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {households.map((h) => <Chip key={h.id} label={h.name} active={h.id === household?.id} onPress={() => void switchHousehold(h.id)} />)}
          </View>
        ) : null}
        {can(household?.role, 'member.invite') ? (
          <Button variant="secondary" icon="share-outline" title="Invitér familiemedlem" disabled={!online} onPress={async () => {
            try {
              const token = await createInvite(supabase, household!.id, 'member');
              await Share.share({ message: `Kom med i vores fælles kogebog i Vores Kok: ${SITE_URL}/invite/${token}` });
            } catch (e) { setMsg({ tone: 'danger', text: toDataError(e).message }); }
          }} />
        ) : null}
      </Card>
      <Card style={{ gap: 12 }}>
        <Title size="lg">Offline</Title>
        <Body muted>{cache?.all().length ?? 0} opskrifter gemt på enheden{cache?.syncedAt ? ` · synkroniseret ${formatDate(cache.syncedAt)} ${new Date(cache.syncedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}` : ''}.</Body>
        <Button variant="secondary" icon="sync-outline" title="Synkronisér nu" loading={syncing} disabled={!online} onPress={() => void sync()} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Title size="lg">Profil</Title>
        <Body muted>{session?.user.email}</Body>
        <Field label="Visningsnavn" value={name} onChangeText={setName} />
        <Button variant="secondary" title="Gem navn" disabled={!online || !name.trim()} onPress={async () => {
          try { await updateMyProfile(supabase, session!.user.id, name.trim()); await supabase.auth.updateUser({ data: { display_name: name.trim() } }); setMsg({ tone: 'success', text: 'Navnet er gemt.' }); }
          catch (e) { setMsg({ tone: 'danger', text: toDataError(e).message }); }
        }} />
      </Card>
      <Card style={{ gap: 8 }}>
        <Title size="lg">På vej</Title>
        <Body muted>Madplan, indkøbslister, Mit køkken og kogetilstand kommer i fase 2. Import og assistent i fase 3.</Body>
      </Card>
      <Button variant="ghost" icon="log-out-outline" title="Log ud" onPress={() => void signOut()} />
      <Body muted size="xs">Når du logger ud, slettes alle gemte opskrifter fra enheden.</Body>
    </ScrollView>
  );
}

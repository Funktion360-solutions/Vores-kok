import { acceptInvite, toDataError } from '@vores-kok/database';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Body, Button, Title } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { supabase } from '@/lib/supabase';

/** Deep link: voreskok://invite/<token> */
export default function Invite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { refreshHouseholds, switchHousehold } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ padding: 24, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
      <Title size="xxl">Du er inviteret</Title>
      <Body muted>Tilslut dig familiens kogebog.</Body>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button title="Tilslut husstanden" loading={busy} onPress={async () => {
        setBusy(true);
        try { const id = await acceptInvite(supabase, String(token)); await refreshHouseholds(); await switchHousehold(id); router.replace('/'); }
        catch (e) { setError(toDataError(e).message); } finally { setBusy(false); }
      }} />
    </View>
  );
}

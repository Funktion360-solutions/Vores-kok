import { signInSchema } from '@vores-kok/validation';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Body, Button, Field, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Udfyld felterne');
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (err) setError(err.code === 'invalid_credentials' ? 'Forkert e-mail eller adgangskode.' : 'Kunne ikke logge ind. Tjek forbindelsen.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.cream }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16 }}>
            <Text style={{ color: c.terracotta, fontWeight: '700', fontSize: 16 }}>Vores Kok</Text>
            <Title size="display">Velkommen tilbage</Title>
            <Body muted>Familiens opskrifter, historier og minder — samlet ét sted.</Body>
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
            <Field label="Adgangskode" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
            <Button title="Log ind" onPress={submit} loading={busy} />
            <Link href="/signup" style={{ color: c.terracotta, fontSize: 16, textAlign: 'center', padding: 12 }}>Opret en konto</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

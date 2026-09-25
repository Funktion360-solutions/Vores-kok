import { signUpSchema } from '@vores-kok/validation';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Banner, Button, Field } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function Signup() {
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Udfyld felterne');
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { display_name: parsed.data.displayName } } });
    setBusy(false);
    if (err) return setError(err.code === 'user_already_exists' ? 'Der findes allerede en konto med den e-mail.' : 'Kunne ikke oprette kontoen.');
    if (!data.session) setInfo('Tjek din e-mail og bekræft kontoen, og log derefter ind.');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
      <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16 }}>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {info ? <Banner tone="success">{info}</Banner> : null}
        <Field label="Dit navn" value={form.displayName} onChangeText={(v) => setForm((f) => ({ ...f, displayName: v }))} autoComplete="name" hint="Vises for din familie" />
        <Field label="E-mail" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Adgangskode" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} secureTextEntry autoComplete="new-password" hint="Mindst 10 tegn" />
        <Button title="Opret konto" onPress={submit} loading={busy} />
      </View>
    </ScrollView>
  );
}

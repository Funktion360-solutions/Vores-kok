import { askAssistant } from '@vores-kok/database';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { type AiReply } from '@vores-kok/validation';
import { Banner, Body, Button, Card, Field, Title } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { supabase } from '@/lib/supabase';
function Chat({ householdId, online }: { householdId: string; online: boolean }) {
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<{ question: string; reply: AiReply }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    if (busy || !online || !message.trim()) return;
    setBusy(true);
    setError('');
    const question = message.trim();
    try {
      const reply = await askAssistant(supabase, {
        householdId,
        message: question,
        history: turns.slice(-4).flatMap((t) => [
          { role: 'user', content: t.question },
          { role: 'assistant', content: t.reply.answer },
        ]),
      });
      setTurns((t) => [...t, { question, reply }]);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assistenten kunne ikke svare.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 20,
        gap: 16,
        maxWidth: 760,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <Title>Vores Kok AI</Title>
      <Body>Spørg om madlavning, bagning og dine ingredienser.</Body>
      <Body muted>
        Dit spørgsmål og relevante opskrifter deles med AI-udbyderen. Historier og billeder deles
        ikke. Samtalen gemmes kun på denne skærm. AI kan tage fejl.
      </Body>
      {!online ? <Banner>Assistenten kræver internet. Din besked bliver stående.</Banner> : null}
      {turns.map((t, i) => (
        <Card key={i}>
          <Title size="lg">{t.question}</Title>
          <Body>{t.reply.answer}</Body>
          {t.reply.recipes.map((r) => (
            <Button
              key={r.id}
              variant="ghost"
              title={r.title}
              onPress={() => router.push(`/recipe/${r.id}`)}
            />
          ))}
        </Card>
      ))}
      <Field
        label="Spørg Vores Kok AI"
        multiline
        maxLength={2000}
        value={message}
        onChangeText={setMessage}
        editable={!busy}
      />
      <Button
        title="Send spørgsmål"
        loading={busy}
        disabled={!online || !message.trim()}
        onPress={() => void send()}
      />
      <Button
        title="Ny samtale"
        variant="ghost"
        disabled={busy}
        onPress={() => {
          setTurns([]);
          setError('');
        }}
      />
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </ScrollView>
  );
}
export default function Assistant() {
  const { household, online } = useApp();
  return household ? (
    <Chat key={household.id} householdId={household.id} online={online} />
  ) : (
    <Banner>Vælg en husstand først.</Banner>
  );
}

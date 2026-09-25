'use client';
import { toDataError, updateMyProfile } from '@vores-kok/database';
import { passwordSchema, profileSchema } from '@vores-kok/validation';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Field, Input } from '../ui';

export function ProfileSettings({ userId, displayName, email }: { userId: string; displayName: string; email: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [pending, start] = useTransition();

  function saveName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ display_name: new FormData(e.currentTarget).get('display_name') });
    if (!parsed.success) return setMsg({ tone: 'danger', text: 'Skriv et navn.' });
    start(async () => {
      try { await updateMyProfile(getBrowserClient(), userId, parsed.data.display_name); setMsg({ tone: 'success', text: 'Navnet er gemt.' }); router.refresh(); }
      catch (err) { setMsg({ tone: 'danger', text: toDataError(err).message }); }
    });
  }
  function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = passwordSchema.safeParse(new FormData(form).get('password'));
    if (!parsed.success) return setMsg({ tone: 'danger', text: parsed.error.issues[0]?.message ?? 'Ugyldig adgangskode' });
    start(async () => {
      const { error } = await getBrowserClient().auth.updateUser({ password: parsed.data });
      setMsg(error ? { tone: 'danger', text: 'Adgangskoden kunne ikke ændres. Log ind igen og prøv igen.' } : { tone: 'success', text: 'Adgangskoden er ændret.' });
      if (!error) form.reset();
    });
  }
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold">Din profil</h2>
      <p className="mt-1 text-sm text-ink-muted">{email}</p>
      {msg ? <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
      <form method="post" onSubmit={saveName} className="mt-4 flex items-end gap-2">
        <Field label="Visningsnavn" htmlFor="display_name" className="flex-1"><Input id="display_name" name="display_name" defaultValue={displayName} maxLength={80} /></Field>
        <Button type="submit" variant="secondary" disabled={pending}>Gem</Button>
      </form>
      <form method="post" id="password" onSubmit={savePassword} className="mt-4 flex items-end gap-2">
        <Field label="Ny adgangskode" htmlFor="password-new" className="flex-1"><Input id="password-new" name="password" type="password" autoComplete="new-password" /></Field>
        <Button type="submit" variant="secondary" disabled={pending}>Skift</Button>
      </form>
    </Card>
  );
}

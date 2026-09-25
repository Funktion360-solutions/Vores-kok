'use client';
import { acceptInvite, createHousehold, toDataError } from '@vores-kok/database';
import { householdNameSchema, inviteTokenSchema } from '@vores-kok/validation';
import { Home, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { switchHousehold } from '@/app/actions';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

/** Accepts either the raw token or a full invite link. */
export function extractToken(v: string): string {
  const m = /\/invite\/([A-Za-z0-9_-]+)/.exec(v);
  return (m?.[1] ?? v).trim();
}

export function OnboardingForms() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = householdNameSchema.safeParse(new FormData(e.currentTarget).get('name'));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    start(async () => {
      try {
        const id = await createHousehold(getBrowserClient(), parsed.data);
        await switchHousehold(id);
        router.replace('/');
        router.refresh();
      } catch (err) {
        setError(toDataError(err).message);
      }
    });
  }

  function onJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = inviteTokenSchema.safeParse(extractToken(String(new FormData(e.currentTarget).get('token') ?? '')));
    if (!parsed.success) return setError('Invitationskoden ser ikke rigtig ud.');
    start(async () => {
      try {
        const id = await acceptInvite(getBrowserClient(), parsed.data);
        await switchHousehold(id);
        router.replace('/');
        router.refresh();
      } catch (err) {
        setError(toDataError(err).message);
      }
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <Home className="mb-3 size-7 text-brand" aria-hidden />
          <h2 className="text-xl font-semibold">Opret en husstand</h2>
          <p className="mt-1 text-sm text-ink-soft">Du bliver ejer og kan invitere resten af familien.</p>
          <form onSubmit={onCreate} className="mt-5 flex flex-col gap-3">
            <Field label="Navn" htmlFor="name"><Input id="name" name="name" placeholder="Fx “Familien Slot”" maxLength={100} /></Field>
            <Button type="submit" disabled={pending}>Opret husstand</Button>
          </form>
        </Card>
        <Card className="p-6">
          <KeyRound className="mb-3 size-7 text-sage" aria-hidden />
          <h2 className="text-xl font-semibold">Tilslut med invitation</h2>
          <p className="mt-1 text-sm text-ink-soft">Indsæt linket eller koden, du har fået.</p>
          <form onSubmit={onJoin} className="mt-5 flex flex-col gap-3">
            <Field label="Invitationslink eller kode" htmlFor="token"><Input id="token" name="token" autoComplete="off" /></Field>
            <Button type="submit" variant="secondary" disabled={pending}>Tilslut</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

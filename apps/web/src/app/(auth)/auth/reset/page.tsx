'use client';
import { emailSchema } from '@vores-kok/validation';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { env } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/client';
import { useHydrated } from '@/lib/use-hydrated';

export default function ResetPage() {
  const hydrated = useHydrated();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(new FormData(e.currentTarget).get('email'));
    if (!parsed.success) return setError('Ugyldig e-mailadresse');
    await getBrowserClient().auth.resetPasswordForEmail(parsed.data, { redirectTo: `${env.siteUrl}/auth/callback?next=/settings%23password` });
    // Same message whether or not the account exists (no account enumeration).
    setSent(true);
  }
  return (
    <>
      <h1 className="text-3xl font-semibold">Nulstil adgangskode</h1>
      {sent ? (
        <div className="mt-8"><Alert tone="success">Hvis der findes en konto med den e-mail, har vi sendt et link.</Alert></div>
      ) : (
        <form method="post" onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
          <Field label="E-mail" htmlFor="email" error={error}><Input id="email" name="email" type="email" autoComplete="email" /></Field>
          <Button type="submit" size="lg" disabled={!hydrated}>Send link</Button>
        </form>
      )}
      <p className="mt-6 text-sm"><Link href="/login" className="text-brand hover:underline">Tilbage til log ind</Link></p>
    </>
  );
}

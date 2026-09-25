'use client';
import { fieldErrors, signUpSchema } from '@vores-kok/validation';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui';
import { env } from '@/lib/env';
import { safeNext } from '@/lib/safe-redirect';
import { getBrowserClient } from '@/lib/supabase/client';

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'), '/onboarding');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({ displayName: form.get('displayName'), email: form.get('email'), password: form.get('password') });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setPending(true);
    setErrors({});
    const { data, error } = await getBrowserClient().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    if (error) {
      return setErrors({ _: error.code === 'user_already_exists' ? 'Der findes allerede en konto med den e-mail.' : error.code === 'weak_password' ? 'Adgangskoden er for svag.' : 'Kunne ikke oprette kontoen. Prøv igen.' });
    }
    if (!data.session) return setCheckEmail(true);
    router.replace(next);
    router.refresh();
  }

  if (checkEmail) {
    return <div className="mt-8"><Alert tone="success">Vi har sendt dig en e-mail. Klik på linket for at bekræfte din konto.</Alert></div>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      {errors._ ? <Alert>{errors._}</Alert> : null}
      <Field label="Dit navn" htmlFor="displayName" error={errors.displayName} hint="Vises for din familie, fx “Mor” eller “Aksel”.">
        <Input id="displayName" name="displayName" autoComplete="name" required aria-invalid={!!errors.displayName} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Adgangskode" htmlFor="password" error={errors.password} hint="Mindst 10 tegn.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="mt-2">{pending ? <Spinner /> : null} Opret konto</Button>
      <p className="text-center text-sm text-ink-soft">Har du allerede en konto? <Link href="/login" className="font-medium text-brand hover:underline">Log ind</Link></p>
    </form>
  );
}

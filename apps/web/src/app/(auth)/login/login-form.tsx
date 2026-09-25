'use client';
import { fieldErrors, signInSchema } from '@vores-kok/validation';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui';
import { safeNext } from '@/lib/safe-redirect';
import { getBrowserClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({ email: form.get('email'), password: form.get('password') });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setPending(true);
    setErrors({});
    const { error } = await getBrowserClient().auth.signInWithPassword(parsed.data);
    if (error) {
      setPending(false);
      return setErrors({ _: error.code === 'invalid_credentials' ? 'Forkert e-mail eller adgangskode.' : 'Kunne ikke logge ind. Prøv igen.' });
    }
    router.replace(safeNext(params.get('next')));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      {errors._ ? <Alert>{errors._}</Alert> : null}
      <Field label="E-mail" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Adgangskode" htmlFor="password" error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!errors.password} />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="mt-2">{pending ? <Spinner /> : null} Log ind</Button>
      <div className="flex justify-between text-sm">
        <Link href="/auth/reset" className="text-ink-soft underline-offset-4 hover:underline">Glemt adgangskode?</Link>
        <Link href={`/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-medium text-brand underline-offset-4 hover:underline">Opret konto</Link>
      </div>
    </form>
  );
}

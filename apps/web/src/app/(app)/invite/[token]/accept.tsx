'use client';
import { acceptInvite, toDataError } from '@vores-kok/database';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { switchHousehold } from '@/app/actions';
import { Alert, Button, LinkButton } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <Button size="lg" disabled={pending} onClick={() => start(async () => {
        try {
          const id = await acceptInvite(getBrowserClient(), token);
          await switchHousehold(id);
        router.replace('/');
        router.refresh();
        } catch (err) {
            setError(toDataError(err).message);
        }
      })}>Tilslut husstanden</Button>
      <LinkButton href="/" variant="ghost">Ikke nu</LinkButton>
    </div>
  );
}

'use client';
import { Button, EmptyState } from '@/components/ui';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Details are logged server-side; never shown to the user.
  return <EmptyState title="Noget gik galt" action={<Button onClick={reset}>Prøv igen</Button>}>Vi kunne ikke hente siden. Tjek din forbindelse og prøv igen.</EmptyState>;
}

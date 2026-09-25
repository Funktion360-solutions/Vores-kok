import type { Metadata } from 'next';
import { AcceptInvite } from './accept';

export const metadata: Metadata = { title: 'Invitation' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="text-3xl font-semibold">Du er inviteret</h1>
      <p className="mt-2 text-ink-soft">Tilslut dig familiens kogebog i Vores Kok.</p>
      <AcceptInvite token={token} />
    </div>
  );
}

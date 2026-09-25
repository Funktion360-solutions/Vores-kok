import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import { OnboardingForms } from './forms';

export const metadata: Metadata = { title: 'Kom i gang' };

export default async function OnboardingPage() {
  const { displayName, households } = await getSession();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-4xl font-semibold">Hej {displayName} 👋</h1>
      <p className="mt-2 max-w-xl text-lg text-ink-soft">
        {households.length ? 'Opret en ny husstand eller tilslut dig en anden.' : 'Vores Kok er bygget omkring en husstand — jeres fælles, private kogebog. Opret jeres egen, eller brug en invitation fra familien.'}
      </p>
      <OnboardingForms />
    </div>
  );
}

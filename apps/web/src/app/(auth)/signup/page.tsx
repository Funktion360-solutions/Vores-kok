import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Opret konto' };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Opret din konto</h1>
      <p className="mt-2 text-ink-soft">Start jeres fælles kogebog, eller tilslut dig din families.</p>
      <Suspense><SignupForm /></Suspense>
    </>
  );
}

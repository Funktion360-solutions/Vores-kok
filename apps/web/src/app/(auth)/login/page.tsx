import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log ind' };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Velkommen tilbage</h1>
      <p className="mt-2 text-ink-soft">Log ind for at se familiens opskrifter.</p>
      <Suspense><LoginForm /></Suspense>
    </>
  );
}

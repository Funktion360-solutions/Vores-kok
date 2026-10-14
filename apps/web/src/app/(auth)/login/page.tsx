import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';
import { Funktion360Login } from './funktion360-login';

export const metadata: Metadata = { title: 'Log ind' };

export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string,sso?:string}>}) {
  const params=await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold">Velkommen tilbage</h1>
      <p className="mt-2 text-ink-soft">Log ind for at se familiens opskrifter.</p>
      <Funktion360Login next={params.next} notice={params.sso}/>
      <Suspense><LoginForm /></Suspense>
    </>
  );
}

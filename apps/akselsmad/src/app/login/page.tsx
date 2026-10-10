import type { Metadata } from 'next';
import { LoginForm } from '@/components/login-form';
export const metadata: Metadata = {
  title: 'Funktion360-login',
  robots: { index: false, follow: false },
};
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next || '/konto';
  return (
    <section className="section reading">
      <span className="eyebrow">DIT FUNKTION360-LOGIN</span>
      <h1>Velkommen i køkkenet.</h1>
      <p>Brug samme konto som i Vores Kok og DEJ. Du logger ind særskilt på denne hjemmeside.</p>
      <LoginForm
        next={
          next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/konto'
        }
      />
    </section>
  );
}

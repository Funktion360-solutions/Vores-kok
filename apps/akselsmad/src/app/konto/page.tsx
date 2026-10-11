import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { SignOut } from '@/components/sign-out';
export const metadata: Metadata = { title: 'Din konto', robots: { index: false, follow: false } };
export default async function Page() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await client
    .from('am_publishers')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (
    <section className="section reading">
      <span className="eyebrow">DIT KØKKEN</span>
      <h1>Velkommen tilbage.</h1>
      <p>Du er logget ind med din Funktion360-konto: {user.email}</p>
      <div className="actions">
        <Link className="button" href="/opskrifter">
          Find en opskrift
        </Link>
        <Link className="button secondary" href="/konto/kogebog">
          Mine favoritter og samlinger
        </Link>
        <Link className="button secondary" href="/konto/downloads">
          Mine PDF-opskrifter
        </Link>
        {data ? (
          <Link className="button secondary" href="/admin">
            Åbn administration ↗
          </Link>
        ) : null}
        <Link className="button secondary" href="/nyhedsbrev">
          Mit nyhedsbrev
        </Link>
        <SignOut />
      </div>
      <h2>Din kogebog i Vores Kok</h2>
      <p>På opskriftssiderne kan du gemme en selvstændig kopi i din private familiekogebog.</p>
      <a href={process.env.NEXT_PUBLIC_VORES_KOK_URL || 'https://voreskok.funktion360.dk'}>
        Åbn Vores Kok ↗
      </a>
    </section>
  );
}

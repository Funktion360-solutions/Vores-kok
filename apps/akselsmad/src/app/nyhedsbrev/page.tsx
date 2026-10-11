import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/supabase';
import { newsletterConfigured } from '@/lib/newsletter-resend';
import { NewsletterSignup } from '@/components/newsletter-signup';
export const metadata: Metadata = {
  title: 'Nyhedsbrev fra Aksels køkken',
  description:
    'Nye opskrifter, grundige guides og små fortællinger fra Aksels køkken. Tilmeld dig AkselsMads nyhedsbrev.',
};
export default async function Page() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  return (
    <section className="section newsletter-public">
      <div className="newsletter-intro">
        <span className="eyebrow">AKSELSMAD · NYHEDSBREV</span>
        <h1>
          En lille bid
          <br />
          af mit køkken.
        </h1>
        <p className="lede">
          Nye opskrifter, italiensk inspiration og bagning med tid til detaljerne. Direkte fra mit
          køkken til din indbakke.
        </p>
        <div className="newsletter-promises">
          <p>
            <strong>Opskrifter, der er værd at gemme</strong>
            <br />
            Mine nyeste favoritter med plads til de små råd.
          </p>
          <p>
            <strong>Lær noget nyt</strong>
            <br />
            Grundige guides og fortællinger om mad og bagning.
          </p>
          <p>
            <strong>På dine betingelser</strong>
            <br />
            Tilmeld dig selv. Afmeld dig, når du vil.
          </p>
        </div>
        <Link href="/privatliv">Sådan behandler jeg dine oplysninger</Link>
      </div>
      {user?.email && user.email_confirmed_at ? (
        <NewsletterSignup email={user.email} configured={newsletterConfigured()} />
      ) : (
        <div className="newsletter-signup">
          <span className="eyebrow">VELKOMMEN I KØKKENET</span>
          <h2>Få næste brev med.</h2>
          <p>
            Brug din Funktion360-konto til at tilmelde din bekræftede e-mail. Login tilmelder dig
            ikke automatisk.
          </p>
          <Link className="button" href="/login?next=/nyhedsbrev">
            Log ind og tilmeld dig →
          </Link>
        </div>
      )}
    </section>
  );
}

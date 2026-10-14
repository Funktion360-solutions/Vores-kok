import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {linkConfig} from '@/lib/funktion360/link-config';
import {PROVIDER} from '@/lib/funktion360/link-checks';

export async function Funktion360Account() {
  const db=await createClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error || !user)return null;
  const linked=Boolean(user.identities?.some(identity=>identity.provider===PROVIDER));
  let canLink=false;
  try{canLink=linkConfig().allowed.includes(user.id);}catch{/* Configuration is optional for existing product accounts. */}
  if(!linked && !canLink)return null;
  return <section aria-labelledby="funktion360-account-title" className="mb-6 rounded-2xl border border-line bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="funktion360-account-title" className="font-display text-xl font-semibold">Funktion360 ID</h2>
      <span className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand-dark">{linked?'Tilknyttet':'Klar til tilknytning'}</span>
    </div>
    <p className="mt-3 text-sm text-ink-soft">{linked?'Din Vores Kok-konto er koblet til Funktion360 ID. Du kan bruge ID-login til denne konto.':'Kobl din eksisterende Vores Kok-konto til Funktion360 ID. Dine opskrifter og din familie bliver på samme konto.'}</p>
    {linked?<a href="https://id.funktion360.dk/account" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand px-4 font-semibold text-brand">Administrér dit Funktion360 ID</a>:<Link href="/auth/funktion360/link" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand px-4 font-semibold text-brand">Kobl din konto</Link>}
  </section>;
}

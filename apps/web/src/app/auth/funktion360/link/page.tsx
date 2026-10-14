import {linkConfig} from '@/lib/funktion360/link-config';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {PROVIDER} from '@/lib/funktion360/link-checks';
import {linkAccount} from './actions';
export const dynamic='force-dynamic';
const messages:Record<string,string>={disabled:'Kontokobling er ikke aktiveret for denne konto.',mfa:'Denne konto har MFA. Kontokobling kræver et særskilt MFA-flow, som endnu ikke er tilføjet.',already:'Din konto har allerede en Funktion360 ID-identitet.',invalid:'Bekræft koblingen og indtast din adgangskode.',password:'Adgangskoden kunne ikke bekræftes.',provider:'Provideren kunne ikke starte koblingen. Kontrollér opsætningen og aktivér Manual Linking i Vores Koks Supabase Auth.',failed:'Koblingen kunne ikke bekræftes. Start et nyt forsøg.',success:'Funktion360 ID er koblet til din eksisterende Vores Kok-konto. Dit bruger-ID er bevaret.'};
export default async function LinkPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  const {notice}=await searchParams;
  let cfg:ReturnType<typeof linkConfig>;
  try{cfg=linkConfig();}catch{return <main className="mx-auto max-w-xl px-6 py-16"><h1>Kontokobling er ikke aktiveret</h1></main>;}
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(user && !cfg.allowed.includes(user.id))return <main className="mx-auto max-w-xl px-6 py-16"><h1>Kontokobling er endnu ikke åbnet for din konto</h1></main>;
  const linked=Boolean(user?.identities?.some(i=>i.provider===PROVIDER));
  return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-3xl font-semibold">Kobl din Vores Kok-konto</h1>{notice && messages[notice]?<p role="status" className="mt-4">{messages[notice]}</p>:null}{user?<><p className="mt-6">Vores Kok-konto: {user.email}</p><p className="mt-2 break-all">Eksisterende bruger-ID: {user.id}</p>{linked?<><p className="mt-6">Funktion360 ID er tilknyttet denne konto.</p><Link className="mt-6 inline-block underline" href="/recipes">Åbn dine opskrifter</Link></>:<><p className="mt-6">Bekræft din nuværende adgangskode. Derefter godkender du koblingen hos Funktion360 ID. Opskrifter og familier beholder deres eksisterende ejer.</p><form action={linkAccount} className="mt-8 flex flex-col gap-4"><label htmlFor="link-password">Vores Kok-adgangskode</label><input id="link-password" name="password" type="password" autoComplete="current-password" required maxLength={256} className="rounded border p-3"/><label className="flex gap-3"><input type="checkbox" name="confirm" value="yes" required/>Jeg ønsker at koble min personlige Funktion360 ID-konto til denne Vores Kok-konto.</label><button className="rounded bg-brand p-3 text-white" type="submit">Bekræft og fortsæt til Funktion360 ID</button></form></>}</>:<><p className="mt-6">Log først ind med din eksisterende Vores Kok-konto.</p><Link className="mt-6 inline-block underline" href="/login?next=%2Fauth%2Ffunktion360%2Flink">Log ind på Vores Kok</Link></>}</main>;
}

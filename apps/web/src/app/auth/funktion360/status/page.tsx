import Link from 'next/link';
import {identity} from '@/lib/funktion360/pilot';
export const dynamic='force-dynamic';
export default async function Status({searchParams}:{searchParams:Promise<{notice?:string,reason?:string}>}) {
  const {notice,reason}=await searchParams;
  let current:Awaited<ReturnType<typeof identity>>;
  try{current=await identity();}catch{ /* Pilot can be unconfigured or disabled. */ }
  return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-3xl font-semibold">Funktion360 ID · lokal pilot</h1>{notice==='failed'?<p role="status">Login blev afvist, udløb eller kunne ikke verificeres. Start et nyt forsøg. {reason && /^[A-Za-z0-9_]{1,120}$/.test(reason)?<strong>Fejlkode: {reason}</strong>:null}</p>:null}{current?<><p className="mt-6">Din Funktion360-identitet er verificeret.</p><dl className="mt-6 break-all"><dt>Identitetsudbyder</dt><dd>{current.issuer}</dd><dt>Bruger-ID</dt><dd>{current.subject}</dd></dl></>:<p className="mt-6">Ingen verificeret ID-session på denne enhed.</p>}<p className="mt-6">Dette tester kun ID-login og tilbagevenden til Vores Kok. Adgang til opskrifter kræver stadig dit eksisterende Vores Kok-login.</p><div className="mt-8 flex flex-col gap-4"><a href="/auth/funktion360/start">Test login med Funktion360 ID</a><Link href="/login">Eksisterende Vores Kok-login</Link></div></main>;
}

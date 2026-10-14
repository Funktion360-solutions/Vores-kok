import {signinReady} from '@/lib/funktion360/signin-config';
import {returnPath} from '@/lib/funktion360/signin-checks';
export function Funktion360Login({next,notice}:{next?:string,notice?:string}) {
  if(!signinReady()) return null;
  return <div className="mt-8 flex flex-col gap-3">{notice==='failed'?<p role="status">ID-login kunne ikke gennemføres. Start et nyt forsøg.</p>:null}{notice==='wrong_account'?<p role="status">Din konto er ikke godkendt til denne ID-loginudrulning.</p>:null}<a className="rounded-lg border border-brand px-5 py-3 text-center font-semibold text-brand" href={'/auth/funktion360/signin?next='+encodeURIComponent(returnPath(next))}>Log ind med Funktion360 ID</a><p className="text-center text-sm text-ink-soft">Eller brug dit eksisterende Vores Kok-login nedenfor.</p></div>;
}

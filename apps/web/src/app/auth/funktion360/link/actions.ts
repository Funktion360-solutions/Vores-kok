'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {store,cookieOptions} from '@/lib/funktion360/pilot';
import {PROVIDER,linkEnabled} from '@/lib/funktion360/link-checks';
export async function linkAccount(form:FormData) {
  if(!linkEnabled(process.env.NODE_ENV,process.env.F360_SSO_PILOT)) redirect('/auth/funktion360/link?notice=disabled');
  const db=await createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError || !user?.email) redirect('/login?next=%2Fauth%2Ffunktion360%2Flink');
  if(user.factors?.some(f=>f.status==='verified')) redirect('/auth/funktion360/link?notice=mfa');
  if(user.identities?.some(i=>i.provider===PROVIDER)) redirect('/auth/funktion360/link?notice=already');
  const password=String(form.get('password') || '');
  if(form.get('confirm')!=='yes' || !password || password.length>256) redirect('/auth/funktion360/link?notice=invalid');
  // IDs and email are derived from the verified session, never from form fields.
  const {data:reauth,error}=await db.auth.signInWithPassword({email:user.email,password});
  if(error || reauth.user?.id!==user.id) redirect('/auth/funktion360/link?notice=password');
  const {data:flow,error:linkError}=await db.auth.linkIdentity({provider:PROVIDER,options:{redirectTo:'http://localhost:3001/auth/funktion360/link/callback',scopes:'openid email profile',skipBrowserRedirect:true}});
  if(linkError || !flow.url) {
    const code=linkError?.code;
    if(code && /^[a-z0-9_]{1,80}$/.test(code)) console.error('[Funktion360 kontokobling]',code);
    redirect('/auth/funktion360/link?notice=provider');
  }
  const target=new URL(flow.url);
  const issuer=new URL(process.env.F360_ID_ISSUER || 'https://fthalqavjmsydmqszvkk.supabase.co/auth/v1');
  if(target.protocol!=='https:' || target.origin!==issuer.origin || target.username || target.password) redirect('/auth/funktion360/link?notice=provider');
  const storage=store();let proof:string;
  try{proof=storage.put('link-proof',{localId:user.id},300_000);}finally{storage.close();}
  (await cookies()).set('vk_f360_link_proof',proof,{...cookieOptions,maxAge:300});
  redirect(target.href);
}

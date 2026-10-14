import {type NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {PROVIDER} from '@/lib/funktion360/link-checks';
import {returnPath} from '@/lib/funktion360/signin-checks';
import {signinConfig,PROOF_COOKIE} from '@/lib/funktion360/signin-config';
import {issueProof} from '@/lib/funktion360/proof';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
  let cfg:ReturnType<typeof signinConfig>;
  try{cfg=signinConfig();}catch{return NextResponse.json({error:'ID-login er ikke konfigureret.'},{status:503});}
  if(request.headers.get('rsc')==='1' || request.headers.has('next-router-prefetch'))return new NextResponse(null,{status:204});
  const db=await createClient();
  const {data,error}=await db.auth.signInWithOAuth({provider:PROVIDER,options:{redirectTo:cfg.origin+'/auth/funktion360/signin/callback',scopes:'openid email profile',skipBrowserRedirect:true}});
  if(error || !data.url){const code=error?.code;if(code && /^[a-z0-9_]{1,80}$/.test(code))console.error('[Funktion360 ID login]',code);return NextResponse.redirect(cfg.origin+'/login?sso=failed');}
  const target=new URL(data.url);
  if(target.origin!==new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || target.protocol!=='https:')return NextResponse.json({error:'Unexpected provider URL'},{status:502});
  const proof=issueProof(returnPath(request.nextUrl.searchParams.get('next')),cfg.secret);
  (await cookies()).set(PROOF_COOKIE,proof,cfg.cookies);
  const response=NextResponse.redirect(target.href);response.headers.set('Cache-Control','private, no-store');return response;
}

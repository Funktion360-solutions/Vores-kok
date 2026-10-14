import {type NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {verifiedLink} from '@/lib/funktion360/link-checks';
import {returnPath} from '@/lib/funktion360/signin-checks';
import {signinConfig,PROOF_COOKIE} from '@/lib/funktion360/signin-config';
import {verifyProof} from '@/lib/funktion360/proof';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
  let cfg:ReturnType<typeof signinConfig>;
  try{cfg=signinConfig();}catch{return NextResponse.json({error:'SSO disabled'},{status:403});}
  const jar=await cookies();const proof=verifyProof(jar.get(PROOF_COOKIE)?.value,cfg.secret);
  jar.set(PROOF_COOKIE,'',{...cfg.cookies,maxAge:0});
  const code=request.nextUrl.searchParams.get('code');
  if(!proof || !code || request.nextUrl.searchParams.getAll('code').length!==1)return NextResponse.redirect(cfg.origin+'/login?sso=failed');
  // Replay is rejected by Supabase's single-use auth code and PKCE verifier.
  const db=await createClient();const {error}=await db.auth.exchangeCodeForSession(code);
  if(error){const safe=error.code;if(safe && /^[a-z0-9_]{1,80}$/.test(safe))console.error('[Funktion360 ID login callback]',safe);return NextResponse.redirect(cfg.origin+'/login?sso=failed');}
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError || !user || !cfg.allowed.some(id=>verifiedLink(user.id,id,user.identities))) {
    await db.auth.signOut({scope:'local'});
    return NextResponse.redirect(cfg.origin+'/login?sso=wrong_account');
  }
  const response=NextResponse.redirect(cfg.origin+returnPath(proof.next));response.headers.set('Cache-Control','private, no-store');return response;
}

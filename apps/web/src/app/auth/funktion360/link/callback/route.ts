import {type NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {linkConfig,LINK_COOKIE} from '@/lib/funktion360/link-config';
import {verifyLinkProof} from '@/lib/funktion360/link-proof';
import {verifiedLink} from '@/lib/funktion360/link-checks';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
  let cfg:ReturnType<typeof linkConfig>;
  try{cfg=linkConfig();}catch{return NextResponse.json({error:'Linking disabled'},{status:403});}
  const destination=cfg.origin+'/auth/funktion360/link';
  const jar=await cookies();const key=jar.get(LINK_COOKIE)?.value;
  jar.set(LINK_COOKIE,'',{...cfg.cookies,maxAge:0});
  const code=request.nextUrl.searchParams.get('code');
  if(!key || !code || request.nextUrl.searchParams.getAll('code').length!==1) return NextResponse.redirect(destination+'?notice=failed');
  const proof=verifyLinkProof(key,cfg.secret);
  if(!proof || !cfg.allowed.includes(proof.localId)) return NextResponse.redirect(destination+'?notice=failed');
  const db=await createClient();
  const {data:{user:before},error:beforeError}=await db.auth.getUser();
  if(beforeError || before?.id!==proof.localId)return NextResponse.redirect(destination+'?notice=failed');
  const {error}=await db.auth.exchangeCodeForSession(code);
  if(error){const safe=error.code;if(safe && /^[a-z0-9_]{1,80}$/.test(safe)) console.error('[Funktion360 kontokobling callback]',safe);return NextResponse.redirect(destination+'?notice=failed');}
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError || !user || !verifiedLink(user.id,proof.localId,user.identities)) {
    await db.auth.signOut({scope:'local'});
    return NextResponse.redirect(destination+'?notice=failed');
  }
  return NextResponse.redirect(destination+'?notice=success');
}

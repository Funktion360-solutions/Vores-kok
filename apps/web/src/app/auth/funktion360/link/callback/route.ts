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
  const fail=(reason:string)=>{console.error('[Funktion360 kontokobling callback]',reason);return NextResponse.redirect(destination+'?notice=failed&reason='+reason);};
  const code=request.nextUrl.searchParams.get('code');
  if(request.nextUrl.searchParams.has('error'))return fail('provider_rejected');
  if(!key)return fail('proof_cookie_missing');
  if(!code || request.nextUrl.searchParams.getAll('code').length!==1)return fail('callback_code_missing');
  const proof=verifyLinkProof(key,cfg.secret);
  if(!proof)return fail('proof_invalid_or_expired');
  if(!cfg.allowed.includes(proof.localId))return fail('account_not_allowed');
  const db=await createClient();
  const {data:{user:before},error:beforeError}=await db.auth.getUser();
  if(beforeError || !before)return fail('original_session_missing');
  if(before.id!==proof.localId)return fail('original_account_changed');
  const {error}=await db.auth.exchangeCodeForSession(code);
  if(error){const safe=error.code;if(safe && /^[a-z0-9_]{1,80}$/.test(safe)) console.error('[Funktion360 kontokobling callback]',safe);return fail('token_exchange_failed');}
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError || !user || !verifiedLink(user.id,proof.localId,user.identities)) {
    await db.auth.signOut({scope:'local'});
    return fail('linked_account_mismatch');
  }
  return NextResponse.redirect(destination+'?notice=success');
}

import {type NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {store,cookieOptions} from '@/lib/funktion360/pilot';
import {linkEnabled,verifiedLink} from '@/lib/funktion360/link-checks';
export const runtime='nodejs';
const destination='http://localhost:3001/auth/funktion360/link';
export async function GET(request:NextRequest) {
  if(!linkEnabled(process.env.NODE_ENV,process.env.F360_SSO_PILOT)) return NextResponse.json({error:'Local linking disabled'},{status:403});
  const jar=await cookies();const key=jar.get('vk_f360_link_proof')?.value;
  jar.set('vk_f360_link_proof','',{...cookieOptions,maxAge:0});
  const code=request.nextUrl.searchParams.get('code');
  if(!key || !code || request.nextUrl.searchParams.getAll('code').length!==1) return NextResponse.redirect(destination+'?notice=failed');
  const storage=store();let proof:{localId:string}|undefined;
  try{proof=storage.take<{localId:string}>(key,'link-proof');}finally{storage.close();}
  if(!proof) return NextResponse.redirect(destination+'?notice=failed');
  const db=await createClient();
  const {error}=await db.auth.exchangeCodeForSession(code);
  if(error){const safe=error.code;if(safe && /^[a-z0-9_]{1,80}$/.test(safe)) console.error('[Funktion360 kontokobling callback]',safe);return NextResponse.redirect(destination+'?notice=failed');}
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError || !user || !verifiedLink(user.id,proof.localId,user.identities)) {
    await db.auth.signOut({scope:'local'});
    return NextResponse.redirect(destination+'?notice=failed');
  }
  return NextResponse.redirect(destination+'?notice=success');
}

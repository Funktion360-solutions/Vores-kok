import {type NextRequest,NextResponse} from 'next/server';
import {safeFailure} from '@/lib/funktion360/diagnostics';
import {finish,settings} from '@/lib/funktion360/pilot';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  try{settings();}catch{return NextResponse.json({error:'Lokal SSO-pilot er ikke konfigureret.'},{status:503});}
  try{await finish(request.nextUrl.search);return NextResponse.redirect('http://localhost:3001/auth/funktion360/status');}
  catch(error){const reason=safeFailure(error);console.error('[Funktion360 SSO callback]',reason);return NextResponse.redirect('http://localhost:3001/auth/funktion360/status?notice=failed&reason='+encodeURIComponent(reason));}
}

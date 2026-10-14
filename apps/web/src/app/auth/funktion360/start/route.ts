import {NextResponse} from 'next/server';
import {start,settings} from '@/lib/funktion360/pilot';
export const runtime='nodejs';
export async function GET(){
  try{settings();}catch{return NextResponse.json({error:'Lokal SSO-pilot er ikke konfigureret.'},{status:503});}
  try{return NextResponse.redirect(await start());}
  catch{return NextResponse.json({error:'ID-forbindelsen kunne ikke oprettes. Kontrollér issuer og klientopsætning.'},{status:502});}
}

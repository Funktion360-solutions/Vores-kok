import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase/server';

/** Exchanges the PKCE code from email links (confirm signup, reset password) for a session. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  if (code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  headers.set('x-nonce', nonce);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${url}; font-src 'self'; connect-src 'self' ${url} ${url.replace(/^http/, 'ws')}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  headers.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers } });
  const client = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, extra) => {
          for (const c of list) request.cookies.set(c.name, c.value);
          response = NextResponse.next({ request: { headers } });
          for (const c of list) response.cookies.set(c.name, c.value, c.options);
          for (const [k, v] of Object.entries(extra ?? {})) response.headers.set(k, v);
        },
      },
    },
  );
  await client.auth.getUser();
  if (
    process.env.AKSELSMAD_ADMIN_HOST &&
    request.nextUrl.hostname === process.env.AKSELSMAD_ADMIN_HOST &&
    request.nextUrl.pathname === '/'
  ) {
    const target = request.nextUrl.clone();
    target.pathname = '/admin';
    const next = NextResponse.redirect(target);
    for (const c of response.cookies.getAll()) next.cookies.set(c);
    response = next;
  }
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

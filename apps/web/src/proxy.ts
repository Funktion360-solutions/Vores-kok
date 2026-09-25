import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback', '/auth/reset'];

function buildCsp(nonce: string): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const ws = supabase.replace(/^http/, 'ws');
  const isDev = process.env.NODE_ENV === 'development';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
    // style attributes from React need 'unsafe-inline' (no script execution possible via CSS here).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${supabase}`,
    `font-src 'self'`,
    `connect-src 'self' ${supabase} ${ws}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    isDev ? '' : 'upgrade-insecure-requests',
  ].filter(Boolean).join('; ');
}

/**
 * Runs on every page request:
 *  1. refreshes the Supabase session cookie (required by @supabase/ssr),
 *  2. redirects signed-out users to /login,
 *  3. sets a per-request CSP nonce.
 * Authorization of data is NOT done here — RLS in the database does that.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = path !== '/' ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : '';
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  if (data.user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|fonts/).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }],
    },
  ],
};

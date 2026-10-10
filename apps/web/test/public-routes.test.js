import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
let signedIn = false;
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'test-user' } : null } }) } }) }));
const { proxy } = await import('../src/proxy');
afterEach(() => { signedIn = false; });
const request = (path) => new NextRequest('https://voreskok.example'+path);
it('serves only public pages anonymously and routes the public entrance to the presentation', async () => {
 const entrance=await proxy(request('/'));
 expect(entrance.headers.get('location')).toBe('https://voreskok.example/om');
 for(const path of ['/om','/funktioner','/robots.txt','/sitemap.xml']) {
  const response=await proxy(request(path));
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
 }
 for(const path of ['/recipes','/shopping/offers','/family','/settings']) {
  const response=await proxy(request(path));
  expect(new URL(response.headers.get('location')).pathname).toBe('/login');
 }
});
it('keeps the signed-in kitchen entrance and redirects signed-in login to it',async()=>{
 signedIn=true;
 expect((await proxy(request('/'))).headers.get('location')).toBeNull();
 expect((await proxy(request('/login'))).headers.get('location')).toBe('https://voreskok.example/');
});

import { expect, it, vi } from 'vitest';
const H = '11111111-1111-4111-8111-111111111111';
const env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only',
  PREJ_API_KEY: 'prej-private',
  AI_ALLOWED_ORIGINS: 'https://app.example',
};
vi.stubGlobal('Deno', { env: { get: (key) => env[key] } });
const { handleOffers } = await import('../../../supabase/functions/offers-sync/index.ts');
it('shares a weekly cache, bounds pagination, and never sends household data or keys to the browser', async () => {
  const original = globalThis.fetch;
  let member = true,
    cached = null,
    providerCalls = 0;
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: H });
    if (url.includes('household_members')) return Response.json(member ? { role: 'viewer' } : null);
    if (url.includes('vk_claim_offer_cache')) {
      expect(new Headers(init.headers).get('apikey')).toBe('server-only');
      const week = JSON.parse(init.body).p_week;
      cached = { week, payload: null };
      return Response.json(true);
    }
    if (url.includes('vk_offer_cache')) {
      if (init.method === 'PATCH') {
        cached.payload = JSON.parse(init.body).payload;
        return new Response(null, { status: 204 });
      }
      return Response.json(cached);
    }
    if (url.startsWith('https://api.prej.app')) {
      providerCalls++;
      expect(url).not.toContain(H);
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer prej-private');
      if (url.includes('flyers')) return Response.json({ flyers: [], as_of: '2026-10-10' });
      return Response.json({ offers: [], total: 300, as_of: '2026-10-10' });
    }
    throw new Error('Unexpected URL ' + url);
  });
  const request = () =>
    new Request('https://edge.example', {
      method: 'POST',
      headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: H }),
    });
  try {
    member = false;
    expect((await handleOffers(request())).status).toBe(403);
    expect(providerCalls).toBe(0);
    member = true;
    const first = await handleOffers(request());
    expect(first.status).toBe(200);
    expect(providerCalls).toBe(9);
    const body = await first.text();
    expect(body).not.toContain('server-only');
    expect(body).not.toContain('prej-private');
    expect(body).toContain('200 tilbud');
    expect((await handleOffers(request())).status).toBe(200);
    expect(providerCalls).toBe(9);
  } finally {
    globalThis.fetch = original;
  }
});

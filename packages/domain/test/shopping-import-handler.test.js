import { expect, it, vi } from 'vitest';
const H = '11111111-1111-4111-8111-111111111111';
const env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'test',
  OPENAI_API_KEY: 'private',
  AI_MODEL: 'test',
  AI_ALLOWED_ORIGINS: 'https://app.example',
};
vi.stubGlobal('Deno', { env: { get: (key) => env[key] } });
const { handleShoppingImport } =
  await import('../../../supabase/functions/shopping-import/index.ts');
it('requires membership, quota and a valid document kind before sending receipt data to AI', async () => {
  const original = globalThis.fetch;
  let role = 'member',
    quota = true,
    calls = 0,
    finish = 'stop';
  const doc = {
    store: 'REMA 1000',
    date: '2026-10-10',
    currency: 'DKK',
    total_ore: 2195,
    lines: [
      {
        name: 'Mælk',
        quantity: 1,
        unit: 'l',
        price_ore: 1995,
        kind: 'product',
        valid_from: null,
        valid_to: null,
        membership: false,
        warnings: [],
      },
      {
        name: 'Pant',
        quantity: null,
        unit: null,
        price_ore: 200,
        kind: 'deposit',
        valid_from: null,
        valid_to: null,
        membership: false,
        warnings: [],
      },
    ],
    warnings: [],
  };
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: H });
    if (url.includes('household_members')) {
      expect(url).toContain('household_id=eq.' + H);
      return Response.json(role ? { role } : null);
    }
    if (url.includes('reserve_ai_request')) return Response.json(quota);
    if (url.includes('chat/completions')) {
      calls++;
      const body = JSON.parse(init.body);
      expect(body.store).toBe(false);
      expect(body.messages[0].content).toContain('Pant');
      expect(body.messages[0].content).toContain('betalingskortnumre');
      return Response.json({
        choices: [{ finish_reason: finish, message: { content: JSON.stringify(doc) } }],
      });
    }
    throw new Error('Unexpected URL');
  });
  const request = (kind = 'receipt', auth = true) => {
    const form = new FormData();
    form.set('householdId', H);
    form.set('kind', kind);
    form.set('text', 'Mælk 19,95 pant 2,00 total 21,95');
    return new Request('https://edge.example', {
      method: 'POST',
      headers: auth ? { Authorization: 'Bearer test' } : {},
      body: form,
    });
  };
  try {
    expect((await handleShoppingImport(request('receipt', false))).status).toBe(401);
    role = 'viewer';
    expect((await handleShoppingImport(request())).status).toBe(403);
    role = null;
    expect((await handleShoppingImport(request())).status).toBe(403);
    role = 'member';
    expect((await handleShoppingImport(request('other'))).status).toBe(400);
    quota = false;
    expect((await handleShoppingImport(request())).status).toBe(429);
    expect(calls).toBe(0);
    quota = true;
    const result = await handleShoppingImport(request());
    expect(result.status).toBe(200);
    expect((await result.json()).lines[1].kind).toBe('deposit');
    finish = 'length';
    expect((await handleShoppingImport(request())).status).toBe(422);
  } finally {
    globalThis.fetch = original;
  }
});

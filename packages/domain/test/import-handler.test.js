import { it, expect, vi } from 'vitest';
const env = { SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'test', OPENAI_API_KEY: 'test', AI_MODEL: 'test', AI_ALLOWED_ORIGINS: 'https://app.example' };
vi.stubGlobal('Deno', { env: { get: key => env[key] } });
const { handleImport } = await import('../../../supabase/functions/recipe-import/index.ts');
const H = '11111111-1111-4111-8111-111111111111';
it('enforces auth, household isolation, role and quota before calling AI', async () => {
  const original = globalThis.fetch;
  let role = 'member'; let quota = true; let providerCalls = 0;
  const recipe = { title: 'Boller', description: null, servings: null, yield_unit: null, prep_minutes: null, cook_minutes: null, total_minutes: null, ingredients: ['500 g mel'], steps: ['Bland dejen'], notes: null, warnings: ['Uklart vandmål'], original_text: 'Boller 500 g mel' };
  globalThis.fetch = vi.fn(async input => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: H });
    if (url.includes('household_members')) { expect(url).toContain(`household_id=eq.${H}`); return Response.json(role ? { role } : null); }
    if (url.includes('reserve_ai_request')) return Response.json(quota);
    if (url.includes('chat/completions')) { providerCalls++; return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ recipes: [recipe] }) } }] }); }
    throw new Error('Unexpected URL');
  });
  const request = (auth = true) => { const f = new FormData(); f.set('householdId', H); f.set('text', 'Boller 500 g mel'); return new Request('https://edge.example', { method: 'POST', headers: auth ? { Authorization: 'Bearer test' } : {}, body: f }); };
  try {
    expect((await handleImport(request(false))).status).toBe(401);
    role = 'viewer'; expect((await handleImport(request())).status).toBe(403);
    role = null; expect((await handleImport(request())).status).toBe(403);
    role = 'member'; quota = false; expect((await handleImport(request())).status).toBe(429);
    expect(providerCalls).toBe(0);
    quota = true; const result = await handleImport(request()); expect(result.status).toBe(200);
    expect((await result.json()).recipes[0].warnings).toEqual(['Uklart vandmål']);
  } finally { globalThis.fetch = original; }
});

import { it, expect, vi } from 'vitest';
const H = '11111111-1111-4111-8111-111111111111';
const R = '22222222-2222-4222-8222-222222222222';
const env = { SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'test', OPENAI_API_KEY: 'test', AI_MODEL: 'test', AI_ALLOWED_ORIGINS: 'https://app.example' };
vi.stubGlobal('Deno', { env: { get: key => env[key] } });
const { handleMealPlan } = await import('../../../supabase/functions/ai-meal-plan/index.ts');
it('enforces membership, quota, household recipes and validates AI recipe IDs', async () => {
  const original = globalThis.fetch;
  let role = 'member'; let quota = true; let outputId = R; let providerCalls = 0; let pantryCalls = 0;
  globalThis.fetch = vi.fn(async input => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: H });
    if (url.includes('household_members')) { expect(url).toContain(`household_id=eq.${H}`); expect(url).toContain(`user_id=eq.${H}`); return Response.json({ role }); }
    if (url.includes('/pantry_items')) { pantryCalls++; expect(url).toContain(`household_id=eq.${H}`); return Response.json([{ name: 'Pasta', quantity: 1, unit: 'pakke', best_before: null }]); }
    if (url.includes('/recipes')) { expect(url).toContain(`household_id=eq.${H}`); return Response.json([{ id: R, title: 'Pasta', description: null, recipe_ingredients: [{ name: 'Pasta' }] }]); }
    if (url.includes('reserve_ai_request')) return Response.json(quota);
    if (url.includes('chat/completions')) { providerCalls++; return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ suggestions: [{ date: '2026-10-12', recipe_id: outputId, reason: 'Hurtig aftensmad' }], warnings: [] }) } }] }); }
    throw new Error('Unexpected URL');
  });
  const request = (auth = true, usePantry = false) => new Request('https://edge.example', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test' } : {}) }, body: JSON.stringify({ householdId: H, dates: ['2026-10-12'], servings: 2, wishes: '', usePantry }) });
  try {
    expect((await handleMealPlan(request(false))).status).toBe(401);
    role = 'viewer'; expect((await handleMealPlan(request())).status).toBe(403);
    role = 'member'; quota = false; expect((await handleMealPlan(request())).status).toBe(429); expect(providerCalls).toBe(0);
    quota = true; expect((await handleMealPlan(request())).status).toBe(200); expect(pantryCalls).toBe(0);
    expect((await handleMealPlan(request(true, true))).status).toBe(200); expect(pantryCalls).toBe(1);
    outputId = H; expect((await handleMealPlan(request())).status).toBe(422);
  } finally { globalThis.fetch = original; }
});

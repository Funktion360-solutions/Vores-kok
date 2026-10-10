import { expect, it, vi } from 'vitest';
const H = '11111111-1111-4111-8111-111111111111';
const R = '22222222-2222-4222-8222-222222222222';
const env = { SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'test', OPENAI_API_KEY: 'test', AI_MODEL: 'test', OPENAI_BASE_URL: 'https://api.openai.com/v1' };
vi.stubGlobal('Deno', { env: { get: key => env[key] } });
const { handleRequest } = await import('../../../supabase/functions/ai-assistant/handler.ts');
it('pins the current recipe even when the question has no matching recipe terms', async () => {
  const original = globalThis.fetch;
  let found = true; let calls = 0;
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: H });
    if (url.includes('household_members')) return Response.json({ role: 'viewer' });
    if (url.includes('reserve_ai_request')) return Response.json(true);
    if (url.includes('/recipes')) {
      expect(url).toContain(`id=eq.${R}`); expect(url).toContain(`household_id=eq.${H}`);
      expect(url).not.toContain('stories');
      return Response.json(found ? [{ id: R, title: 'Boller', description: null, servings: 4, recipe_ingredients: [{ name: 'Mel', quantity: 500, unit: 'g' }], recipe_steps: [{ position: 0, body: 'Fold dejen fire gange.' }] }] : []);
    }
    if (url.includes('chat/completions')) {
      calls++;
      const body = JSON.parse(init.body);
      expect(body.messages[1].content).toContain('Fold dejen fire gange.');
      expect(body.messages[1].content).toContain('Den aktuelle opskrift er valgt eksplicit');
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Løft kanten og fold ind over midten.' } }] });
    }
    throw new Error('Unexpected URL');
  });
  const request = () => new Request('https://edge.example', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: H, recipeId: R, message: 'Hvordan gør jeg i trin 1?' }) });
  try {
    const result = await handleRequest(request()); expect(result.status).toBe(200); expect((await result.json()).recipes).toEqual([{ id: R, title: 'Boller' }]);
    found = false; expect((await handleRequest(request())).status).toBe(404); expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});

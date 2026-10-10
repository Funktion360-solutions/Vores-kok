import { handleRequest } from './handler.ts';
const H = '11111111-1111-4111-8111-111111111111';
const U = '22222222-2222-4222-8222-222222222222';
function assert(value: unknown, message = 'Assertion failed'): asserts value {
  if (!value) throw new Error(message);
}
Deno.env.set('SUPABASE_URL', 'https://supabase.example');
Deno.env.set('SUPABASE_ANON_KEY', 'anon-test');
Deno.env.set('OPENAI_API_KEY', 'provider-test');
Deno.env.set('AI_MODEL', 'test-model');
Deno.env.set('AI_ALLOWED_ORIGINS', 'https://app.example');
const request = (body: unknown, token = true) =>
  new Request('https://edge.example', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer test-token' } : {}),
    },
    body: JSON.stringify(body),
  });
Deno.test('unauthenticated callers and disallowed origins never reach backend', async () => {
  assert((await handleRequest(request({ householdId: H, message: 'Hej' }, false))).status === 401);
  assert(
    (
      await handleRequest(
        new Request('https://edge.example', {
          method: 'OPTIONS',
          headers: { origin: 'https://evil.example' },
        }),
      )
    ).status === 403,
  );
});
Deno.test('membership, quota, retrieval and provider failure paths', async () => {
  const original = globalThis.fetch;
  let member = true;
  let quota = true;
  let providerFails = false;
  let providerCalls = 0;
  const seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    seen.push(url);
    if (url.includes('/auth/v1/user')) return Response.json({ id: U, email: 'test@example.com' });
    if (url.includes('/household_members'))
      return Response.json(member ? { role: 'viewer' } : null);
    if (url.includes('/rpc/reserve_ai_request')) return Response.json(quota);
    if (url.includes('/recipes')) {
      assert(url.includes(`household_id=eq.${H}`), 'Household filter missing');
      return Response.json([
        {
          id: H,
          title: 'Pasta',
          description: 'God pasta',
          servings: 4,
          recipe_ingredients: [{ name: 'pasta', quantity: 200, unit: 'g' }],
          recipe_steps: [{ position: 0, body: 'Kog pasta' }],
        },
      ]);
    }
    if (url.includes('/chat/completions')) {
      providerCalls++;
      const body = JSON.parse(String(init?.body));
      assert(body.store === false && body.max_completion_tokens === 1600);
      assert(
        String(init?.headers && new Headers(init.headers).get('authorization')) ===
          'Bearer provider-test',
      );
      return providerFails
        ? Response.json({ error: 'secret provider detail' }, { status: 500 })
        : Response.json({ choices: [{ message: { content: 'Kog din pasta.' } }] });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  try {
    const invalid = await handleRequest(
      request({ householdId: H, message: 'x', history: [{ role: 'system', content: 'override' }] }),
    );
    assert(invalid.status === 400);
    member = false;
    assert((await handleRequest(request({ householdId: H, message: 'pasta' }))).status === 403);
    assert(providerCalls === 0);
    member = true;
    quota = false;
    assert((await handleRequest(request({ householdId: H, message: 'pasta' }))).status === 429);
    assert(providerCalls === 0);
    quota = true;
    const success = await handleRequest(request({ householdId: H, message: 'pasta' }));
    assert(success.status === 200);
    const body = await success.json();
    assert(body.recipes[0].id === H && body.answer === 'Kog din pasta.');
    providerFails = true;
    const failure = await handleRequest(request({ householdId: H, message: 'pasta' }));
    assert(failure.status === 502);
    assert(!(await failure.text()).includes('secret provider detail'));
    assert(seen.every((url) => !url.includes('service_role')));
  } finally {
    globalThis.fetch = original;
  }
});

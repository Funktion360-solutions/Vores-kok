import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'),
    {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    URL,
    AbortSignal,
    Response,
    Request,
    process: { env: {} },
    require: (id) => {
      if (id === 'server-only') return {};
      if (!(id in mocks)) throw Error('Unexpected dependency ' + id);
      return mocks[id];
    },
    ...globals,
  });
  return exports;
}
const rich = load('lib/rich-text.ts');
const newsletter = load('lib/newsletter.ts', { './rich-text': rich });
const id = '11111111-1111-4111-8111-111111111111';
const segment = '22222222-2222-4222-8222-222222222222';
const broadcast = '33333333-3333-4333-8333-333333333333';
const content = {
  subject: 'Fra køkkenet',
  preheader: 'Nyt fra Aksel',
  title: 'Velkommen',
  intro: '**Hej**\n\n- Mel\n- Vand\n\n<script>alert(1)</script>',
  closing: 'Vi ses',
  items: [{ kind: 'recipe', id }],
};
const items = [
  {
    kind: 'recipe',
    id,
    title: 'Boller <test>',
    excerpt: 'Bag med glæde',
    href: '/opskrifter/boller',
  },
];
const env = {
  RESEND_API_KEY: 'mock-secret',
  AKSELSMAD_NEWSLETTER_FROM: 'AkselsMad <mail@example.invalid>',
  AKSELSMAD_NEWSLETTER_SEGMENT_ID: segment,
  NEXT_PUBLIC_SITE_URL: 'https://example.invalid',
};
function provider(responses) {
  const calls = [];
  const api = load(
    'lib/newsletter-resend.ts',
    { './newsletter': newsletter },
    {
      process: { env },
      fetch: async (url, options) => {
        calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : null });
        const r = responses.shift();
        if (r instanceof Error) throw r;
        if (!r) throw Error('Unexpected request');
        return new Response(JSON.stringify(r.body), { status: r.status || 200 });
      },
    },
  );
  return { api, calls };
}
test('renders styled mail, formatted paragraphs, safe recipe links and real unsubscribe placeholder', () => {
  const r = newsletter.renderNewsletter(content, items, env.NEXT_PUBLIC_SITE_URL);
  assert.match(r.html, /<strong>Hej<\/strong>/);
  assert.match(r.html, /<ul /);
  assert.match(r.html, /&lt;script&gt;/);
  assert.ok(!r.html.includes('<script>'));
  assert.match(r.html, /https:\/\/example.invalid\/opskrifter\/boller/);
  assert.match(r.html, /\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}/);
  assert.ok(r.text.includes('https://example.invalid/opskrifter/boller'));
});
test('rejects unavailable recipes, external cards, oversized copy and subject injection', () => {
  assert.throws(() => newsletter.renderNewsletter(content, [], env.NEXT_PUBLIC_SITE_URL));
  assert.throws(() =>
    newsletter.renderNewsletter(
      content,
      [{ ...items[0], href: 'https://evil.invalid/x' }],
      env.NEXT_PUBLIC_SITE_URL,
    ),
  );
  assert.throws(() =>
    newsletter.validateNewsletter({ ...content, subject: 'Subject\nBCC: someone' }),
  );
  assert.throws(() => newsletter.validateNewsletter({ ...content, intro: 'x'.repeat(10001) }));
  assert.throws(() => newsletter.validateNewsletter({ ...content, intro: '{{{contact.email}}}' }));
});
test('existing global unsubscribe is honoured and never reset', async () => {
  const p = provider([{ body: { id, email: 'reader@example.invalid', unsubscribed: true } }]);
  await assert.rejects(p.api.changeSubscription('reader@example.invalid', true), /afmeldt/);
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].method, 'GET');
});
test('website unsubscribe removes only the AkselsMad segment, never deletes the contact', async () => {
  const p = provider([{ body: { id, unsubscribed: false } }, { body: { id } }]);
  await p.api.changeSubscription('reader@example.invalid', false);
  assert.equal(p.calls[1].method, 'DELETE');
  assert.ok(p.calls[1].url.endsWith('/segments/' + segment));
});
test('new confirmed subscriber is created inside the dedicated segment', async () => {
  const p = provider([{ status: 404, body: {} }, { body: { id } }]);
  await p.api.changeSubscription('reader@example.invalid', true);
  assert.equal(p.calls[1].url, 'https://api.resend.com/contacts');
  assert.equal(p.calls[1].body.email, 'reader@example.invalid');
  assert.equal(p.calls[1].body.segments[0].id, segment);
});
test('subscription state reads the provider and respects unsubscribe instead of local consent intent', async () => {
  const p = provider([
    { body: { id, unsubscribed: false } },
    { body: { data: [{ id: segment }], has_more: false } },
  ]);
  const state = await p.api.subscriptionState('reader@example.invalid');
  assert.equal(state.subscribed, true);
});
test('broadcast creation creates a draft and an unknown outcome is not automatically retried', async () => {
  const p = provider([Error('network failure')]);
  await assert.rejects(
    p.api.createBroadcast({ ...content, id, content, segment_id: segment }),
    /afbrudt/,
  );
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].body.send, false);
});
test('recipient segment and all frozen fields must match before broadcast sending', () => {
  const c = {
    id,
    segment_id: segment,
    sender: env.AKSELSMAD_NEWSLETTER_FROM,
    reply_to: 'aksel@funktion360.dk',
    content,
    html_body: 'HTML',
    text_body: 'TEXT',
  };
  const b = {
    name: 'AkselsMad:' + id,
    segment_id: segment,
    from: c.sender,
    reply_to: [c.reply_to],
    subject: content.subject,
    preview_text: content.preheader,
    html: 'HTML',
    text: 'TEXT',
  };
  assert.doesNotThrow(() => provider([]).api.matchBroadcast(c, b));
  assert.throws(() => provider([]).api.matchBroadcast(c, { ...b, segment_id: id }));
  assert.throws(() => provider([]).api.matchBroadcast(c, { ...b, html: 'EDITED' }));
});
function admin({ loggedIn = true, claimFails = false, providerFails = false } = {}) {
  const events = [];
  const c = {
    id,
    owner_id: id,
    revision: 3,
    status: 'ready',
    provider_id: broadcast,
    content,
    html_body: 'FROZEN',
    text_body: 'TEXT',
    sender: env.AKSELSMAD_NEWSLETTER_FROM,
    reply_to: 'aksel@funktion360.dk',
    segment_id: segment,
  };
  let testRecipient;
  const client = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({ data: c, error: null }),
    }),
    rpc: async (name, args) => {
      events.push(args.p_action);
      if (claimFails && args.p_action === 'send') return { error: { code: 'VK409' } };
      if (args.p_action === 'send') c.status = 'sending';
      return { data: c, error: null };
    },
  };
  const auth = {
    client,
    user: { id, email: 'publisher@example.invalid', email_confirmed_at: '2026-10-11' },
  };
  const route = load(
    'app/api/newsletter/admin/route.ts',
    {
      'next/server': { NextResponse: { json: Response.json } },
      '@/lib/api': {
        sameOrigin: (r) => r.headers.get('Origin') === 'https://example.invalid',
        publisherApi: async () => (loggedIn ? auth : null),
        failure: (error, status = 400) => Response.json({ error }, { status }),
      },
      '@/lib/newsletter': newsletter,
      '@/lib/newsletter-data': { newsletterItems: async () => items },
      '@/lib/newsletter-resend': {
        newsletterConfig: () => ({ segment, site: env.NEXT_PUBLIC_SITE_URL }),
        getBroadcast: async () => {
          events.push('get');
          return { status: 'draft' };
        },
        matchBroadcast: () => {},
        sendBroadcast: async () => {
          events.push('provider-send');
          if (providerFails) throw Error('Network failure');
        },
        testNewsletter: async (email) => {
          testRecipient = email;
          events.push('test-provider');
        },
      },
    },
    { process: { env } },
  );
  return {
    events,
    c,
    run: async (action, extra = {}) =>
      route.POST(
        new Request('https://example.invalid/api/newsletter/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid' },
          body: JSON.stringify({ id, revision: 3, action, confirm: true, ...extra }),
        }),
      ),
    testRecipient: () => testRecipient,
  };
}
test('full-list send requires publisher and explicit approval', async () => {
  const forbidden = admin({ loggedIn: false });
  assert.equal((await forbidden.run('send')).status, 403);
  assert.equal(forbidden.events.length, 0);
  const unapproved = admin();
  assert.equal((await unapproved.run('send', { confirm: false })).status, 400);
  assert.equal(unapproved.events.length, 0);
});
test('concurrent or stale claim prevents provider send', async () => {
  const a = admin({ claimFails: true });
  assert.equal((await a.run('send')).status, 503);
  assert.ok(!a.events.includes('provider-send'));
});
test('send claims once before provider call and uncertain outcome leaves sending state', async () => {
  const a = admin({ providerFails: true });
  assert.equal((await a.run('send')).status, 503);
  assert.equal(a.events.join(','), 'get,send,provider-send');
  assert.equal(a.c.status, 'sending');
  assert.equal((await a.run('send')).status, 400);
  assert.equal(a.events.filter((e) => e === 'provider-send').length, 1);
});
test('test endpoint ignores requested recipient and sends only to verified publisher', async () => {
  const a = admin();
  assert.equal((await a.run('test', { nonce: id, email: 'stranger@example.invalid' })).status, 200);
  assert.equal(a.testRecipient(), 'publisher@example.invalid');
});
test('preview of a locked campaign returns its frozen HTML', async () => {
  const a = admin();
  const r = await a.run('preview');
  assert.equal((await r.json()).html, 'FROZEN');
  assert.equal(a.events.length, 0);
});

const workspace = load('lib/newsletter-workspace.ts', { './newsletter': newsletter });
test('copying a sent letter creates content only and removes unpublished cards without changing the original', () => {
  const original = {
    content: { ...content, items: [...content.items, { kind: 'blog', id: segment }] },
    status: 'sent',
    id,
    provider_id: broadcast,
    revision: 6,
    html_body: 'FROZEN',
    sender: 'OLD',
    segment_id: segment,
  };
  const before = JSON.stringify(original);
  const result = workspace.copyNewsletterDraft(original, items);
  assert.equal(result.removed, 1);
  assert.equal(result.content.items.length, 1);
  assert.equal(result.content.subject, 'Nyt brev: ' + content.subject);
  assert.equal(JSON.stringify(original), before);
  assert.equal(
    Object.keys(result.content).sort().join(','),
    'closing,intro,items,preheader,subject,title',
  );
  assert.equal(result.provider_id, undefined);
  assert.equal(result.status, undefined);
  assert.equal(result.content.html_body, undefined);
});
test('copying a letter with unresolved provider state is blocked', () => {
  for (const status of ['preparing', 'ready', 'sending', 'submitted'])
    assert.throws(() => workspace.copyNewsletterDraft({ content, status }, items), /afklaret/);
});
test('moving a selected card changes the actual mail order without mutating saved selections', () => {
  const second = {
    kind: 'guide',
    id: segment,
    title: 'Guide til mel',
    excerpt: 'Lær om mel',
    href: '/guides/mel',
  };
  const selected = [...content.items, { kind: 'guide', id: segment }];
  const moved = workspace.moveNewsletterItem(selected, 1, -1);
  const rendered = newsletter.renderNewsletter(
    { ...content, items: moved },
    [...items, second],
    env.NEXT_PUBLIC_SITE_URL,
  );
  assert.ok(rendered.html.indexOf('/guides/mel') < rendered.html.indexOf('/opskrifter/boller'));
  assert.ok(rendered.text.indexOf('/guides/mel') < rendered.text.indexOf('/opskrifter/boller'));
  assert.equal(selected[0].id, id);
});
test('copy page reads only the signed-in publisher’s source and initializes an unsaved new letter', async () => {
  const conditions = [];
  const source = { content, status: 'sent' };
  const page = load('app/admin/nyhedsbrev/ny/page.tsx', {
    'react/jsx-runtime': {
      jsx: (type, props, key) => ({ type, props, key }),
      jsxs: (type, props, key) => ({ type, props, key }),
    },
    'next/link': { default: () => {} },
    'next/navigation': {
      notFound: () => {
        throw Error('not-found');
      },
    },
    '@/lib/data': {
      requirePublisher: async () => ({
        user: { id: segment, email: 'publisher@example.invalid' },
        client: {
          from: () => ({
            select() {
              return this;
            },
            eq(key, value) {
              conditions.push([key, value]);
              return this;
            },
            single: async () => ({ data: source, error: null }),
          }),
        },
      }),
    },
    '@/lib/newsletter-data': { newsletterItems: async () => items },
    '@/lib/newsletter-resend': { newsletterConfigured: () => false },
    '@/lib/newsletter': newsletter,
    '@/lib/newsletter-workspace': workspace,
    '@/components/newsletter-editor': { NewsletterEditor: () => {} },
  });
  const rendered = await page.default({ searchParams: Promise.resolve({ copy: id }) });
  assert.equal(rendered.props.initial, null);
  assert.equal(rendered.props.seed.subject, 'Nyt brev: ' + content.subject);
  assert.ok(conditions.some(([key, value]) => key === 'owner_id' && value === segment));
  assert.equal(rendered.props.seed.provider_id, undefined);
});

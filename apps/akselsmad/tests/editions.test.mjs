import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(
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
  vm.runInNewContext(code, {
    exports,
    TextEncoder,
    URL,
    Response,
    require: (id) => {
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime') return jsx;
      if (id === 'server-only') return {};
      if (!(id in mocks)) throw Error('Unexpected import ' + id);
      return mocks[id];
    },
  });
  return exports;
}
const lib = load('lib/editions.ts');
const key = '11111111-1111-4111-8111-111111111111';
const recipe = '22222222-2222-4222-8222-222222222222';
const content = () => ({
  title: 'Italiensk middag',
  excerpt: 'Salat & pasta',
  intro: 'Mit køkken',
  category: 'Gæstemad',
  chapters: [
    {
      key,
      title: 'Antipasti <script>',
      intro: 'Begynd med salaten.',
      items: [{ type: 'recipe', id: recipe }],
    },
  ],
});
const uuid = (value) => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
const next = {
  NextResponse: {
    json: (body, options = {}) =>
      new Response(JSON.stringify(body), { status: options.status || 200 }),
  },
};
const failure = (error, status = 400) => next.NextResponse.json({ error }, { status });
function request(body, origin = 'https://example.invalid') {
  return new Request('https://example.invalid/api/editions', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const link = {
  __esModule: true,
  default: (props) => React.createElement('a', props, props.children),
};
test('edition content rejects duplicate chapters, duplicate references, external links and invalid shapes', () => {
  assert.equal(lib.validEdition(content()), true);
  const duplicate = content();
  duplicate.chapters.push({ ...duplicate.chapters[0] });
  assert.equal(lib.validEdition(duplicate), false);
  const repeated = content();
  repeated.chapters[0].items.push({ ...repeated.chapters[0].items[0] });
  assert.equal(lib.validEdition(repeated), false);
  const external = content();
  external.chapters[0].items[0] = { type: 'url', id: 'https://private.invalid' };
  assert.equal(lib.validEdition(external), false);
  const extra = content();
  extra.owner_id = 'somebody';
  assert.equal(lib.validEdition(extra), false);
  for (const invalid of [
    null,
    {},
    { ...content(), chapters: [] },
    { ...content(), title: 'a' },
    { ...content(), intro: 'a'.repeat(20001) },
  ])
    assert.equal(lib.validEdition(invalid), false);
});
test('moving chapters preserves stable progress keys without mutating saved content', () => {
  const before = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  const after = lib.moveEditionItem(before, 0, 1);
  assert.equal(after.map((c) => c.key).join(), 'b,a,c');
  assert.equal(before.map((c) => c.key).join(), 'a,b,c');
  assert.equal(
    lib
      .moveEditionItem(before, 0, -1)
      .map((c) => c.key)
      .join(),
    'a,b,c',
  );
});
test('publisher endpoint rejects cross origin and ordinary users before any RPC', async () => {
  let called = 0;
  const route = load('app/api/editions/route.ts', {
    'next/server': next,
    '@/lib/api': {
      failure,
      sameOrigin: (r) => r.headers.get('origin') === new URL(r.url).origin,
      publisherApi: async () => {
        called++;
        return null;
      },
    },
    '@/lib/personal': { uuid },
    '@/lib/editions': lib,
  });
  assert.equal((await route.POST(request({}, 'https://other.invalid'))).status, 403);
  assert.equal(called, 0);
  assert.equal((await route.POST(request({}))).status, 403);
  assert.equal(called, 1);
});
test('publication carries explicit approval and expected revision; stale writes return conflict', async () => {
  let sent;
  let error = null;
  const route = load('app/api/editions/route.ts', {
    'next/server': next,
    '@/lib/api': {
      failure,
      sameOrigin: () => true,
      publisherApi: async () => ({
        client: {
          rpc: async (name, args) => {
            assert.equal(name, 'am_edit_edition');
            sent = args;
            return { data: key, error };
          },
        },
      }),
    },
    '@/lib/personal': { uuid },
    '@/lib/editions': lib,
  });
  const response = await route.POST(
    request({ action: 'publish', id: key, revision: 4, confirm: true }),
  );
  assert.equal(response.status, 200);
  assert.equal(sent.p_revision, 4);
  assert.equal(sent.p_confirm, true);
  error = { code: 'VK409' };
  assert.equal(
    (await route.POST(request({ action: 'publish', id: key, revision: 3, confirm: true }))).status,
    409,
  );
  const malformed = content();
  malformed.chapters[0].items[0].type = 'private';
  assert.equal(
    (
      await route.POST(
        request({ action: 'save', revision: 0, slug: 'test', kind: 'book', content: malformed }),
      )
    ).status,
    400,
  );
});
test('progress is attributed to the authenticated account, never a supplied user ID', async () => {
  let saved;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'real-account' } } }) },
    from: (table) => {
      assert.equal(table, 'am_course_progress');
      return {
        upsert: async (value, options) => {
          saved = { value, options };
          return { error: null };
        },
      };
    },
  };
  const route = load('app/api/editions/progress/route.ts', {
    'next/server': next,
    '@/lib/api': { failure, sameOrigin: () => true },
    '@/lib/supabase': { db: async () => client },
    '@/lib/personal': { uuid },
  });
  assert.equal(
    (
      await route.POST(
        request({ id: recipe, chapter: key, completed: true, user_id: 'other-account' }),
      )
    ).status,
    200,
  );
  assert.equal(saved.value.user_id, 'real-account');
  assert.equal(saved.options.ignoreDuplicates, true);
  client.auth.getUser = async () => ({ data: { user: null } });
  assert.equal(
    (await route.POST(request({ id: recipe, chapter: key, completed: true }))).status,
    401,
  );
});
test('public reader has matching chapter anchors, safe text and no link for unavailable private content', async () => {
  const rich = load('lib/rich-text.ts');
  const RichText = load('components/rich-text.tsx', { '@/lib/rich-text': rich });
  const progress = load('components/course-progress.tsx', { 'next/link': link });
  const body = load('components/edition-body.tsx', {
    'next/link': link,
    '@/lib/editions': lib,
    '@/lib/editions-data': { editionOptions: async () => [] },
    '@/lib/supabase': {
      db: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    },
    './rich-text': RichText,
    './course-progress': progress,
  });
  const markup = renderToStaticMarkup(
    await body.EditionBody({
      edition: { id: recipe, kind: 'course', slug: 'italien', content: content() },
    }),
  );
  assert.ok(markup.includes('id="kapitel-' + key + '"'));
  assert.ok(markup.includes('href="#kapitel-' + key + '"'));
  assert.ok(markup.includes('Antipasti &lt;script&gt;'));
  assert.ok(!markup.includes('/opskrifter/'));
  assert.ok(markup.includes('ikke tilgængeligt'));
  assert.ok(markup.includes('Log ind og gem din fremgang'));
});
test('private preview never creates learner progress or newsletter signup; book has no whole-book download', async () => {
  const rich = load('lib/rich-text.ts');
  const RichText = load('components/rich-text.tsx', { '@/lib/rich-text': rich });
  const body = load('components/edition-body.tsx', {
    'next/link': link,
    '@/lib/editions': lib,
    '@/lib/editions-data': {
      editionOptions: async () => [
        {
          type: 'recipe',
          id: recipe,
          title: 'Salat',
          category: 'Salater',
          href: '/opskrifter/salat',
        },
      ],
    },
    '@/lib/supabase': {
      db: async () => {
        throw Error('Preview must not read progress');
      },
    },
    './rich-text': RichText,
    './course-progress': {
      CourseProgress: () => {
        throw Error('Preview must not render progress');
      },
    },
  });
  const preview = renderToStaticMarkup(
    await body.EditionBody({
      edition: { id: recipe, kind: 'course', slug: 'italien', content: content() },
      preview: true,
    }),
  );
  assert.ok(preview.includes('/opskrifter/salat'));
  assert.ok(!preview.includes('/nyhedsbrev'));
  const book = renderToStaticMarkup(
    await body.EditionBody({
      edition: { id: recipe, kind: 'book', slug: 'italien', content: content() },
    }),
  );
  assert.ok(book.includes('fem opskrifter'));
  assert.ok(!book.includes('/api/pdf'));
  assert.ok(!book.includes('download='));
});
test('saved course progress is rendered as completed steps rather than reset to zero', () => {
  const progress = load('components/course-progress.tsx', { 'next/link': link });
  const markup = renderToStaticMarkup(
    React.createElement(progress.CourseProgress, {
      id: recipe,
      chapters: [{ key, title: 'Salaten' }],
      initial: [key],
      signedIn: true,
      path: '/forloeb/salat',
    }),
  );
  assert.ok(markup.includes('1 af 1 trin gennemført'));
  assert.ok(markup.includes('aria-pressed="true"'));
  assert.ok(!markup.includes('Log ind og gem'));
});

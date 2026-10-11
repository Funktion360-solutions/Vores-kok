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
    process: { env: { NEXT_PUBLIC_SITE_URL: 'https://example.invalid' } },
    require: (id) => {
      if (id === 'server-only') return {};
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime') return jsx;
      if (!(id in mocks)) throw Error('Unexpected import ' + id);
      return mocks[id];
    },
  });
  return exports;
}
const rich = load('lib/rich-text.ts');
const editorial = load('lib/editorial.ts', { './rich-text': rich });
const components = load('components/rich-text.tsx', { '@/lib/rich-text': rich });
const content = {
  title: 'Min guide',
  excerpt: 'Lær noget nyt',
  category: 'Bagning',
  cover_path: '',
  cover_alt: '',
  blocks: [
    { type: 'text', text: '## **Dejen**\n\nRør godt.\n\n## Dejen\n\nLad hvile.' },
    { type: 'text', text: '## <script>Utrygt</script>\n\nSikker tekst.' },
  ],
};
function article() {
  let recommendations = 0;
  let shared;
  const body = load('components/article-body.tsx', {
    'next/image': { __esModule: true, default: (props) => React.createElement('img', props) },
    'next/link': {
      __esModule: true,
      default: (props) => React.createElement('a', props, props.children),
    },
    './rich-text': components,
    './recipe-card': { RecipeCard: () => null },
    './article-card': { ArticleCard: () => null },
    './article-actions': {
      ArticleActions: (props) => {
        shared = props.url;
        return React.createElement('div', { 'data-public-link': props.url });
      },
    },
    '@/lib/supabase': { db: async () => ({}) },
    '@/lib/editorial-data': {
      editorialPhoto: async () => null,
      relatedArticles: async () => {
        recommendations++;
        return [];
      },
    },
    '@/lib/editorial': editorial,
  });
  return { run: body.ArticleBody, shared: () => shared, recommendations: () => recommendations };
}
test('the rendered article has matching, unique H2 anchors for every table-of-contents entry', async () => {
  const a = article();
  const html = renderToStaticMarkup(
    await a.run({
      content,
      kind: 'guide',
      articleId: 'test',
      publicPath: '/guides/min-guide',
      publishedAt: '2026-10-11T10:00:00Z',
    }),
  );
  const outline = editorial.articleOutline(content);
  assert.equal(outline.length, 3);
  assert.equal(outline[0].title, 'Dejen');
  assert.equal(new Set(outline.map((i) => i.id)).size, 3);
  for (const item of outline) {
    assert.ok(html.includes('href="#' + item.id + '"'));
    assert.ok(html.includes('<h2 id="' + item.id + '"'));
  }
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(a.shared(), 'https://example.invalid/guides/min-guide');
});
test('private preview renders reading tools without publishing a share link or recommendations', async () => {
  const a = article();
  const html = renderToStaticMarkup(await a.run({ content, kind: 'blog' }));
  assert.equal(a.shared(), undefined);
  assert.equal(a.recommendations(), 0);
  assert.ok(html.includes('Kladdens forhåndsvisning'));
  assert.ok(!html.includes('article-newsletter'));
});
test('the shared rich-text renderer preserves its existing heading level outside article pages', () => {
  const html = renderToStaticMarkup(
    React.createElement(components.RichText, { text: '## En overskrift\n\n**Fed** tekst' }),
  );
  assert.ok(html.includes('<h4>En overskrift</h4>'));
  assert.ok(html.includes('<strong>Fed</strong>'));
  assert.ok(!html.includes('id='));
});
test('related articles use only visible, already published rows in the same category and a bounded result', async () => {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'lte', 'neq', 'order'])
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  query.limit = async (limit) => {
    calls.push(['limit', limit]);
    return { data: [], error: null };
  };
  const data = load('lib/editorial-data.ts', {
    react: { ...React, cache: (fn) => fn },
    './supabase': { db: async () => ({ from: () => query }) },
  });
  // React.cache is a pass-through in this test's serverless function context.
  await data.relatedArticles('current-id', 'Bagning');
  assert.ok(calls.some((c) => c[0] === 'eq' && c[1] === 'visible' && c[2] === true));
  assert.ok(calls.some((c) => c[0] === 'lte' && c[1] === 'published_at'));
  assert.ok(
    calls.some((c) => c[0] === 'eq' && c[1] === 'content->>category' && c[2] === 'Bagning'),
  );
  assert.ok(calls.some((c) => c[0] === 'neq' && c[1] === 'id' && c[2] === 'current-id'));
  assert.ok(calls.some((c) => c[0] === 'limit' && c[1] === 3));
});

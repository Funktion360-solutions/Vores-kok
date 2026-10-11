'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TextEditor } from './text-editor';
import { RichText } from './rich-text';
import { browserDb } from '@/lib/client';
import { slugify } from '@/lib/model';
import {
  articleCategories,
  articlePath,
  articleStatus,
  type Article,
  type ArticleBlock,
  type ArticleContent,
  type ArticleDraft,
} from '@/lib/editorial';
const empty: ArticleContent = {
  title: '',
  excerpt: '',
  category: 'Bagning',
  cover_path: '',
  cover_alt: '',
  blocks: [{ type: 'text', text: '' }],
};
export function ArticleEditor({
  initial,
  published,
  recipes,
  asOf,
}: {
  asOf: number;
  initial: ArticleDraft | null;
  published: Article | null;
  recipes: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(initial?.content || empty);
  const [blocks, setBlocks] = useState(() =>
    (initial?.content.blocks || empty.blocks).map((block, i) => ({ key: 'initial-' + i, block })),
  );
  const [kind, setKind] = useState<'guide' | 'blog'>(initial?.kind || 'guide');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [at, setAt] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function changed() {
    setDirty(true);
    setConfirmed(false);
    setMessage('');
  }
  function field<K extends keyof ArticleContent>(key: K, value: ArticleContent[K]) {
    setContent((p) => ({ ...p, [key]: value }));
    changed();
  }
  function block(key: string, value: ArticleBlock) {
    setBlocks((p) => p.map((b) => (b.key === key ? { ...b, block: value } : b)));
    changed();
  }
  function move(index: number, delta: number) {
    setBlocks((p) => {
      const rows = [...p];
      [rows[index], rows[index + delta]] = [rows[index + delta]!, rows[index]!];
      return rows;
    });
    changed();
  }
  async function upload(file: File, key?: string) {
    setBusy(true);
    setMessage('');
    try {
      if (
        file.size > 10 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      )
        throw new Error('Vælg JPG, PNG eller WebP på højst 10 MB.');
      const client = browserDb();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error('Log ind igen.');
      const path =
        user.id +
        '/' +
        crypto.randomUUID() +
        '.' +
        (file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp');
      const { error } = await client.storage
        .from('akselsmad-editorial')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error('Billedet kunne ikke uploades.');
      if (key)
        setBlocks((p) =>
          p.map((b) =>
            b.key === key && b.block.type === 'image' ? { ...b, block: { ...b.block, path } } : b,
          ),
        );
      else setContent((p) => ({ ...p, cover_path: path }));
      changed();
      setMessage('Billedet er uploadet. Tilføj en billedbeskrivelse, og gem kladden.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload mislykkedes.');
    } finally {
      setBusy(false);
    }
  }
  async function action(action: 'save' | 'publish' | 'unpublish') {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: initial?.id,
          kind,
          slug: slug || slugify(content.title),
          content: { ...content, blocks: blocks.map((b) => b.block) },
          revision: initial?.revision,
          publishedRevision: published?.published_revision,
          confirm: confirmed,
          at: at ? new Date(at).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (action === 'save') {
        setDirty(false);
        router.replace('/admin/indhold/' + data.id);
        router.refresh();
        setMessage('Kladden er gemt.');
      } else {
        setConfirmed(false);
        setMessage(
          action === 'unpublish'
            ? 'Artiklen er taget af hjemmesiden.'
            : at
              ? 'Udgivelsen er planlagt.'
              : 'Artiklen er udgivet.',
        );
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Handlingen mislykkedes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section editorial-editor">
      <Link
        href="/admin/indhold"
        onClick={(e) => {
          if (dirty && !window.confirm('Forlad siden uden at gemme ændringerne?'))
            e.preventDefault();
        }}
      >
        ← Guides og blog
      </Link>
      <span className="eyebrow">AKSELSMAD · REDAKTION</span>
      <h1>{initial ? 'Giv din fortælling form.' : 'En ny fortælling begynder her.'}</h1>
      <p className="lede">
        Byg med tekst, egne billeder og opskrifter. Gem som kladde, og godkend den offentlige
        udgave, når du er klar.
      </p>
      <div className="editorial-workspace">
        <div>
          <fieldset disabled={busy}>
            <legend>Grundlæggende</legend>
            <div className="editorial-form-grid">
              <label>
                Indholdstype
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as 'guide' | 'blog');
                    changed();
                  }}
                >
                  <option value="guide">Guide</option>
                  <option value="blog">Blogindlæg</option>
                </select>
              </label>
              <label>
                Kategori
                <select
                  value={content.category}
                  onChange={(e) => field('category', e.target.value)}
                >
                  {articleCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Titel
              <input
                value={content.title}
                maxLength={180}
                onChange={(e) => field('title', e.target.value)}
                placeholder="Fx Sådan lærer du din surdej at kende"
              />
            </label>
            <label>
              Adresse
              <input
                value={slug}
                maxLength={160}
                onChange={(e) => {
                  setSlug(e.target.value);
                  changed();
                }}
                placeholder={slugify(content.title) || 'min-guide'}
              />
            </label>
            <small>
              /{kind === 'guide' ? 'guides' : 'blog'}/{slug || slugify(content.title)}
            </small>
            <label>
              Kort introduktion
              <textarea
                value={content.excerpt}
                maxLength={600}
                rows={3}
                onChange={(e) => field('excerpt', e.target.value)}
              />
            </label>
            <label>
              Forsidebillede
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = '';
                }}
              />
            </label>
            {content.cover_path ? (
              <div className="notice">
                Forsidebilledet er valgt.{' '}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    field('cover_path', '');
                    field('cover_alt', '');
                  }}
                >
                  Fjern forsidebillede
                </button>
              </div>
            ) : null}
            <label>
              Beskriv forsidebilledet
              <input
                value={content.cover_alt}
                maxLength={400}
                onChange={(e) => field('cover_alt', e.target.value)}
                placeholder="En kort beskrivelse til læsere, der ikke kan se billedet"
              />
            </label>
          </fieldset>
          <div className="section-heading">
            <h2>Din artikel</h2>
            <button
              type="button"
              className="secondary"
              aria-pressed={preview}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? 'Redigér tekst' : 'Vis tekstformatering'}
            </button>
          </div>
          {blocks.map(({ key, block: b }, i) => (
            <fieldset key={key} disabled={busy} className="article-block-editor">
              <legend>
                Blok {i + 1} ·{' '}
                {b.type === 'text' ? 'Tekst' : b.type === 'image' ? 'Billede' : 'Opskrift'}
              </legend>
              <div className="block-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={'Flyt blok ' + (i + 1) + ' op'}
                >
                  ↑ Op
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={i === blocks.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓ Ned
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={blocks.length === 1}
                  onClick={() => {
                    setBlocks((p) => p.filter((b) => b.key !== key));
                    changed();
                  }}
                >
                  Fjern blok
                </button>
              </div>
              {b.type === 'text' ? (
                preview ? (
                  <RichText text={b.text} />
                ) : (
                  <TextEditor
                    label="Tekst"
                    value={b.text}
                    rows={10}
                    onChange={(text) => block(key, { type: 'text', text })}
                  />
                )
              ) : b.type === 'image' ? (
                <>
                  <label>
                    Vælg eget billede
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void upload(file, key);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <p>
                    {b.path
                      ? 'Billede valgt. Se det i kladdens forhåndsvisning efter gem.'
                      : 'Intet billede valgt.'}
                  </p>
                  <label>
                    Billedbeskrivelse
                    <input
                      value={b.alt}
                      maxLength={400}
                      onChange={(e) => block(key, { ...b, alt: e.target.value })}
                    />
                  </label>
                  <label>
                    Billedtekst
                    <textarea
                      value={b.caption}
                      rows={2}
                      maxLength={1000}
                      onChange={(e) => block(key, { ...b, caption: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Offentlig opskrift
                  <select value={b.id} onChange={(e) => block(key, { ...b, id: e.target.value })}>
                    <option value="">Vælg opskrift</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
          ))}
          <div className="block-actions">
            {(['text', 'image', 'recipe'] as const).map((type) => (
              <button
                type="button"
                className="secondary"
                key={type}
                disabled={busy || blocks.length >= 100}
                onClick={() => {
                  const b: ArticleBlock =
                    type === 'text'
                      ? { type, text: '' }
                      : type === 'image'
                        ? { type, path: '', alt: '', caption: '' }
                        : { type, id: '' };
                  setBlocks((p) => [...p, { key: crypto.randomUUID(), block: b }]);
                  changed();
                }}
              >
                + {type === 'text' ? 'Tekst' : type === 'image' ? 'Billede' : 'Opskrift'}
              </button>
            ))}
          </div>
        </div>
        <aside className="publication-panel">
          <span className="eyebrow">UDGIVELSE</span>
          <h2>Fra kladde til læser.</h2>
          <span className="status">
            {articleStatus(published || undefined, initial?.revision || 0, asOf)}
          </span>
          <p>
            {dirty
              ? 'Du har ændringer, der ikke er gemt.'
              : initial
                ? 'Kladden er gemt.'
                : 'Gem din første kladde.'}
          </p>
          <button
            type="button"
            disabled={busy || !content.title.trim()}
            onClick={() => void action('save')}
          >
            {busy ? 'Arbejder…' : 'Gem kladde'}
          </button>
          {initial ? (
            <Link
              className="button secondary"
              href={'/admin/indhold/' + initial.id + '/preview'}
              onClick={(e) => {
                if (
                  dirty &&
                  !window.confirm(
                    'Forhåndsvisningen viser kun den gemte kladde. Fortsæt uden at gemme?',
                  )
                )
                  e.preventDefault();
              }}
            >
              Se gemt forhåndsvisning ↗
            </Link>
          ) : null}
          <label>
            Udgivelsestidspunkt
            <input
              type="datetime-local"
              value={at}
              disabled={busy}
              onChange={(e) => {
                setAt(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <small>
            Tomt felt = udgiv nu. Tidspunktet følger din computers lokale tid. Planlægning af en ny
            udgave skjuler den nuværende artikel indtil tidspunktet.
          </small>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || dirty || !initial}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Jeg har gennemgået indhold og billeder og godkender udgivelsen.
          </label>
          <button
            type="button"
            disabled={busy || dirty || !initial || !confirmed}
            onClick={() => void action('publish')}
          >
            {at ? 'Planlæg udgivelse' : 'Udgiv godkendt kladde'}
          </button>
          {published?.visible ? (
            <>
              <a href={articlePath(published)}>Åbn offentlig adresse ↗</a>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Tag artiklen af hjemmesiden? Kladden bevares.'))
                    void action('unpublish');
                }}
              >
                Tag af hjemmesiden
              </button>
            </>
          ) : null}
          <p role="status" aria-live="polite">
            {message}
          </p>
        </aside>
      </div>
    </section>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TextEditor } from './text-editor';
import {
  editionCategories,
  editionPath,
  moveEditionItem,
  validEdition,
  type EditionDraft,
  type Edition,
  type EditionOption,
  type EditionContent,
  type EditionChapter,
  type EditionKind,
} from '@/lib/editions';
export function EditionEditor({
  initial,
  published,
  kind,
  options,
  seed,
}: {
  initial: EditionDraft | null;
  published: Edition | null;
  kind: EditionKind;
  options: EditionOption[];
  seed: EditionContent;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initial?.content || seed);
  const [slug, setSlug] = useState(initial?.slug || '');
  const [autoSlug, setAutoSlug] = useState(!initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const course = kind === 'course';
  const dirty =
    !initial ||
    JSON.stringify(content) !== JSON.stringify(initial.content) ||
    slug !== initial.slug;
  const available = new Map(options.map((o) => [o.type + ':' + o.id, o]));
  const filtered = options.filter((o) =>
    (o.title + ' ' + o.category).toLocaleLowerCase('da').includes(search.toLocaleLowerCase('da')),
  );
  function update(value: EditionContent) {
    setContent(value);
    setConfirm(false);
  }
  function chapter(key: string, patch: Partial<EditionChapter>) {
    update({
      ...content,
      chapters: content.chapters.map((ch) => (ch.key === key ? { ...ch, ...patch } : ch)),
    });
  }
  async function action(action: 'save' | 'publish' | 'unpublish') {
    if (action === 'save' && !validEdition(content)) {
      setMessage(
        'Udfyld titel, tema og kapitler. Højst 30 kapitler, 20 elementer pr. kapitel og 100 i alt.',
      );
      return;
    }
    if (
      action === 'unpublish' &&
      !window.confirm('Skjul denne udgivelse for læserne? Kladden bevares.')
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/editions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: initial?.id || null,
          revision: initial?.revision || 0,
          kind,
          slug,
          content,
          confirm,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Handlingen kunne ikke gennemføres.');
      setMessage(
        action === 'save'
          ? 'Kladden er gemt.'
          : action === 'publish'
            ? 'Udgivelsen er offentlig.'
            : 'Udgivelsen er skjult.',
      );
      setConfirm(false);
      router.replace('/admin/udgivelser/' + data.id);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Handlingen kunne ikke gennemføres.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section edition-admin">
      <Link href="/admin/udgivelser">← Temaforløb og kogebøger</Link>
      <span className="eyebrow">{course ? 'TEMAFORLØB' : 'KOGEBOG'} · REDAKTION</span>
      <h1>{initial ? 'Giv indholdet en sammenhæng.' : 'En ny udgivelse begynder her.'}</h1>
      <p className="lede">
        Saml opskrifter, guides og fortællinger med dine egne introduktioner. Kun offentlige
        AkselsMad-opskrifter og artikler kan vælges.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action('save');
        }}
      >
        <fieldset disabled={busy}>
          <legend>Om udgivelsen</legend>
          <label>
            Titel
            <input
              required
              maxLength={180}
              value={content.title}
              onChange={(e) => {
                const title = e.target.value;
                update({ ...content, title });
                if (autoSlug)
                  setSlug(
                    title
                      .toLocaleLowerCase('da')
                      .replace(/æ/g, 'ae')
                      .replace(/ø/g, 'oe')
                      .replace(/å/g, 'aa')
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')
                      .slice(0, 160),
                  );
              }}
            />
          </label>
          <label>
            Adresse
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={160}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setAutoSlug(false);
                setConfirm(false);
              }}
            />
            <small>
              /{course ? 'forloeb' : 'kogeboeger'}/{slug || 'din-adresse'}
            </small>
          </label>
          <label>
            Tema
            <select
              value={content.category}
              onChange={(e) => update({ ...content, category: e.target.value })}
            >
              {[...new Set([...editionCategories, content.category])].filter(Boolean).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Kort præsentation
            <textarea
              maxLength={600}
              rows={3}
              value={content.excerpt}
              onChange={(e) => update({ ...content, excerpt: e.target.value })}
            />
          </label>
          <TextEditor
            label="Introduktion til udgivelsen"
            value={content.intro}
            onChange={(intro) => update({ ...content, intro })}
          />
          <label>
            Søg blandt offentligt indhold
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pasta, salater, italiensk …"
              maxLength={200}
            />
          </label>
          <p className="muted">
            {options.length} opskrifter og artikler kan vælges. Gem og udgiv opskrifter fra Vores
            Kok i den almindelige opskriftsredaktion først.
          </p>
          {content.chapters.map((ch, index) => (
            <section className="edition-editor-chapter" key={ch.key}>
              <div className="edition-chapter-toolbar">
                <h2>
                  {course ? 'Trin' : 'Kapitel'} {index + 1}
                </h2>
                <div className="block-actions">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={'Flyt ' + ch.title + ' op'}
                    onClick={() =>
                      update({ ...content, chapters: moveEditionItem(content.chapters, index, -1) })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === content.chapters.length - 1}
                    aria-label={'Flyt ' + ch.title + ' ned'}
                    onClick={() =>
                      update({ ...content, chapters: moveEditionItem(content.chapters, index, 1) })
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={content.chapters.length === 1}
                    onClick={() => {
                      if (window.confirm('Fjern ' + ch.title + ' og dets indholdsvalg?'))
                        update({
                          ...content,
                          chapters: content.chapters.filter((c) => c.key !== ch.key),
                        });
                    }}
                  >
                    Fjern
                  </button>
                </div>
              </div>
              <label>
                {course ? 'Trinnets titel' : 'Kapitlets titel'}
                <input
                  required
                  maxLength={180}
                  value={ch.title}
                  onChange={(e) => chapter(ch.key, { title: e.target.value })}
                />
              </label>
              <TextEditor
                label={'Introduktion til ' + (course ? 'trin' : 'kapitel') + ' ' + (index + 1)}
                value={ch.intro}
                onChange={(intro) => chapter(ch.key, { intro })}
              />
              <label>
                Tilføj en opskrift eller artikel
                <select
                  value=""
                  disabled={ch.items.length >= 20}
                  onChange={(e) => {
                    const option = available.get(e.target.value);
                    if (option)
                      chapter(ch.key, {
                        items: [...ch.items, { type: option.type, id: option.id }],
                      });
                  }}
                >
                  <option value="">Vælg offentligt indhold …</option>
                  {filtered
                    .filter((o) => !ch.items.some((i) => i.type === o.type && i.id === o.id))
                    .map((o) => (
                      <option key={o.type + o.id} value={o.type + ':' + o.id}>
                        {o.type === 'recipe' ? 'Opskrift' : o.type === 'guide' ? 'Guide' : 'Blog'} ·{' '}
                        {o.title}
                      </option>
                    ))}
                </select>
              </label>
              <ol className="edition-editor-items">
                {ch.items.map((item, n) => {
                  const option = available.get(item.type + ':' + item.id);
                  return (
                    <li key={item.type + item.id}>
                      <span>
                        {option?.title ||
                          'Ikke offentligt tilgængelig — fjern eller udgiv indholdet igen.'}
                      </span>
                      <div className="block-actions">
                        <button
                          type="button"
                          disabled={n === 0}
                          aria-label={'Flyt element ' + (n + 1) + ' op'}
                          onClick={() =>
                            chapter(ch.key, { items: moveEditionItem(ch.items, n, -1) })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={n === ch.items.length - 1}
                          aria-label={'Flyt element ' + (n + 1) + ' ned'}
                          onClick={() =>
                            chapter(ch.key, { items: moveEditionItem(ch.items, n, 1) })
                          }
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            chapter(ch.key, { items: ch.items.filter((_, i) => i !== n) })
                          }
                        >
                          Fjern
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <button
            type="button"
            disabled={content.chapters.length >= 30}
            onClick={() =>
              update({
                ...content,
                chapters: [
                  ...content.chapters,
                  {
                    key: crypto.randomUUID(),
                    title: course ? 'Næste trin' : 'Nyt kapitel',
                    intro: '',
                    items: [],
                  },
                ],
              })
            }
          >
            + Tilføj {course ? 'trin' : 'kapitel'}
          </button>
          <div className="edition-save">
            <button type="submit">{busy ? 'Arbejder …' : 'Gem kladde'}</button>
            <span className="muted">
              {dirty ? 'Der er ændringer, som ikke er gemt.' : 'Kladden er gemt.'}
            </span>
          </div>
        </fieldset>
      </form>
      <section className="edition-publish">
        <h2>Klar til læserne?</h2>
        <p>
          {published?.visible
            ? published.published_revision === initial?.revision
              ? 'Udgivet.'
              : 'Udgivet — kladden har nyere ændringer.'
            : 'Ikke offentlig endnu.'}
        </p>
        <p>
          Gem først. Forhåndsvisning og godkendelse bruger den gemte kladde. Opskrifter og artikler
          åbnes i deres aktuelle offentlige version.
        </p>
        {initial ? (
          <Link className="button secondary" href={'/admin/udgivelser/' + initial.id + '/preview'}>
            Forhåndsvis gemt kladde ↗
          </Link>
        ) : null}
        <label className="edition-approval">
          <input
            type="checkbox"
            checked={confirm}
            disabled={busy || dirty}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          Jeg har gennemgået den gemte kladde og godkender offentlig udgivelse.
        </label>
        <div className="block-actions">
          <button
            type="button"
            disabled={busy || dirty || !confirm || !initial}
            onClick={() => void action('publish')}
          >
            Udgiv godkendt kladde
          </button>
          {published?.visible ? (
            <>
              <Link href={editionPath(published)}>Åbn offentlig udgivelse ↗</Link>
              <button
                type="button"
                disabled={busy || dirty}
                onClick={() => void action('unpublish')}
              >
                Skjul udgivelse
              </button>
            </>
          ) : null}
        </div>
      </section>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

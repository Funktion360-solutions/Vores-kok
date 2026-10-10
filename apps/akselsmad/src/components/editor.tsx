'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TextEditor } from './text-editor';
import { browserDb } from '@/lib/client';
import {
  categories,
  collections,
  detailFields,
  emptyRecipe,
  slugify,
  type Draft,
  type Recipe,
} from '@/lib/model';
export function Editor({ initial, published }: { initial: Draft | null; published: boolean }) {
  const [r, setR] = useState<Recipe>(initial?.content || emptyRecipe);
  const [slug, setSlug] = useState(initial?.slug || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();
  function change<K extends keyof Recipe>(key: K, value: Recipe[K]) {
    setR((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setConfirmed(false);
  }
  async function action(type: string) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          id: initial?.id,
          slug: slug || slugify(r.title),
          content: r,
          revision: initial?.revision,
          confirm: confirmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (type === 'save') {
        router.push('/admin/' + data.id);
        router.refresh();
        setDirty(false);
        return;
      }
      setMessage(
        type === 'publish' ? 'Opskriften er nu udgivet.' : 'Opskriften er taget af hjemmesiden.',
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Handlingen mislykkedes.');
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
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
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
      const path = user.id + '/' + crypto.randomUUID() + '.' + ext;
      const { error } = await client.storage
        .from('akselsmad-photos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error('Billedet kunne ikke uploades.');
      change('cover_path', path);
      setMessage('Billedet er uploadet. Gem kladden for at knytte det til opskriften.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload mislykkedes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section editor">
      <Link href="/admin">← Alle kladder</Link>
      <span className="eyebrow">
        REDAKTION · {initial ? 'VERSION ' + initial.revision : 'NY OPSKRIFT'}
      </span>
      <h1>{initial ? 'Gør opskriften klar.' : 'En ny opskrift begynder her.'}</h1>
      <p>
        Ændringer gemmes i en kladde. En tidligere udgivet version ændres først, når du udgiver
        igen.
      </p>
      <div className="editor-state" role="status">
        <span className={dirty ? 'state-dot unsaved' : 'state-dot'} />
        {dirty ? 'Ændringer er ikke gemt' : 'Du redigerer en kladde'}
      </div>
      <fieldset disabled={busy}>
        <div className="editor-grid">
          <label>
            Titel
            <input
              maxLength={200}
              value={r.title}
              onChange={(e) => change('title', e.target.value)}
            />
          </label>
          <label>
            Adresse på hjemmesiden
            <input
              value={slug}
              placeholder={slugify(r.title)}
              maxLength={160}
              onChange={(e) => {
                setSlug(e.target.value);
                setDirty(true);
                setConfirmed(false);
              }}
            />
          </label>
        </div>
        <TextEditor
          label="Introduktion"
          value={r.description}
          onChange={(value) => change('description', value)}
          placeholder="Fortæl om smagen, retten og hvorfor du holder af den."
        />
        <div className="editor-grid">
          <label>
            Kategori
            <select value={r.category} onChange={(e) => change('category', e.target.value)}>
              {!categories.includes(r.category) ? <option>{r.category}</option> : null}
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Køkken / inspiration
            <input
              value={r.cuisine}
              placeholder="Fx italiensk"
              onChange={(e) => change('cuisine', e.target.value)}
            />
          </label>
          <label>
            Antal
            <input
              type="number"
              min={1}
              max={1000}
              value={r.servings}
              onChange={(e) => change('servings', Number(e.target.value))}
            />
          </label>
          <label>
            Enhed
            <input
              value={r.yield_unit}
              placeholder="personer, boller, stk"
              onChange={(e) => change('yield_unit', e.target.value)}
            />
          </label>
          {(['prep_minutes', 'cook_minutes', 'total_minutes'] as const).map((key, n) => (
            <label key={key}>
              {['Forberedelse (min)', 'Tilberedning (min)', 'Samlet tid inkl. hævning (min)'][n]}
              <input
                type="number"
                min={0}
                value={r[key] ?? ''}
                onChange={(e) => change(key, e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>
          ))}
          <label>
            Sværhedsgrad
            <select value={r.difficulty} onChange={(e) => change('difficulty', e.target.value)}>
              <option value="">Ikke angivet</option>
              <option value="easy">Let</option>
              <option value="medium">Middel</option>
              <option value="hard">Svær</option>
            </select>
          </label>
        </div>
        <label>
          Tags / samlinger, adskilt med komma
          <input
            value={r.tags.join(', ')}
            placeholder={collections.slice(0, 4).join(', ')}
            onChange={(e) =>
              change(
                'tags',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
        <h2>Ingredienser</h2>
        {r.ingredients.map((i, n) => (
          <div className="ingredient-editor" key={n}>
            <label>
              Mængde
              <input
                type="number"
                min="0.0001"
                step="any"
                value={i.quantity ?? ''}
                onChange={(e) =>
                  change(
                    'ingredients',
                    r.ingredients.map((x, j) =>
                      j === n
                        ? { ...x, quantity: e.target.value === '' ? null : Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Enhed
              <input
                value={i.unit || ''}
                onChange={(e) =>
                  change(
                    'ingredients',
                    r.ingredients.map((x, j) => (j === n ? { ...x, unit: e.target.value } : x)),
                  )
                }
              />
            </label>
            <label>
              Ingrediens
              <input
                value={i.name}
                onChange={(e) =>
                  change(
                    'ingredients',
                    r.ingredients.map((x, j) => (j === n ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
            </label>
            <label>
              Forberedelse
              <input
                value={i.preparation || ''}
                placeholder="Fx finthakket"
                onChange={(e) =>
                  change(
                    'ingredients',
                    r.ingredients.map((x, j) =>
                      j === n ? { ...x, preparation: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              className="secondary"
              disabled={r.ingredients.length === 1}
              onClick={() =>
                change(
                  'ingredients',
                  r.ingredients.filter((_, j) => j !== n),
                )
              }
              aria-label={'Fjern ingrediens ' + (n + 1)}
            >
              Fjern
            </button>
          </div>
        ))}
        <button
          className="secondary"
          onClick={() =>
            change('ingredients', [...r.ingredients, { name: '', quantity: null, unit: '' }])
          }
        >
          Tilføj ingrediens
        </button>
        <h2>Detaljeret fremgangsmåde</h2>
        {r.steps.map((s, n) => (
          <div className="step-editor" key={n}>
            <TextEditor
              label={'Trin ' + (n + 1)}
              value={s.body}
              onChange={(value) =>
                change(
                  'steps',
                  r.steps.map((x, j) => (j === n ? { ...x, body: value } : x)),
                )
              }
              placeholder="Beskriv, hvad man gør, og hvad man skal kigge efter."
            />
            <label>
              Vejledende minutter
              <input
                type="number"
                min={0}
                value={s.timer_seconds == null ? '' : s.timer_seconds / 60}
                onChange={(e) =>
                  change(
                    'steps',
                    r.steps.map((x, j) =>
                      j === n
                        ? {
                            ...x,
                            timer_seconds:
                              e.target.value === '' ? null : Number(e.target.value) * 60,
                          }
                        : x,
                    ),
                  )
                }
              />
            </label>
            <button
              className="secondary"
              disabled={r.steps.length === 1}
              onClick={() =>
                change(
                  'steps',
                  r.steps.filter((_, j) => j !== n),
                )
              }
            >
              Fjern trin
            </button>
          </div>
        ))}
        <button
          className="secondary"
          onClick={() => change('steps', [...r.steps, { body: '', timer_seconds: null }])}
        >
          Tilføj trin
        </button>
        <h2>Det, der gør opskriften grundig</h2>
        <div className="detail-editors">
          {detailFields.map(([key, title]) => (
            <TextEditor
              key={key}
              label={title}
              value={r[key] || ''}
              onChange={(value) => change(key, value)}
              placeholder={
                key === 'baking'
                  ? 'Fx dejtemperatur, meltype, vandprocent, hævetegn og tidsplan samme dag / næste dag'
                  : 'Tilføj dine forklaringer, råd og erfaringer.'
              }
            />
          ))}
        </div>
        <h2>Dit eget billede</h2>
        <p>
          Vælg kun et billede, du ønsker offentliggjort. Billeder fra Vores Kok importeres ikke
          automatisk.
        </p>
        <label>
          Upload forsidebillede
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
        {r.cover_path ? (
          <p>
            Billede tilknyttet{' '}
            <button className="secondary" onClick={() => change('cover_path', '')}>
              Fjern fra opskriften
            </button>
          </p>
        ) : null}
        <div className="publish-panel">
          <h2>Gem, gennemse og udgiv</h2>
          <div className="actions">
            <button disabled={!r.title.trim()} onClick={() => action('save')}>
              {busy ? 'Arbejder…' : 'Gem kladde'}
            </button>
            {initial ? (
              <Link
                className="button secondary"
                target="_blank"
                href={'/admin/' + initial.id + '/preview'}
              >
                Se gemt forhåndsvisning ↗
              </Link>
            ) : null}
          </div>
          {initial ? (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  disabled={dirty}
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Jeg har gennemgået den gemte forhåndsvisning og godkender, at teksten og det valgte
                billede bliver offentlige.
              </label>
              <button disabled={dirty || !confirmed} onClick={() => action('publish')}>
                {published ? 'Udgiv den nye version' : 'Udgiv opskriften'}
              </button>
              {dirty ? <p>Gem ændringerne, før du gennemser og udgiver.</p> : null}
              {published ? (
                <button className="secondary" onClick={() => action('unpublish')}>
                  Tag opskriften af hjemmesiden
                </button>
              ) : null}
            </>
          ) : null}
          <p role="status">{message}</p>
        </div>
      </fieldset>
    </section>
  );
}

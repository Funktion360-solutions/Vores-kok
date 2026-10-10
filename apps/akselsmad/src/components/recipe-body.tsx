'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Recipe } from '@/lib/model';
import { detailFields, totalTime } from '@/lib/model';
export function RecipeBody({
  recipe: r,
  image,
  preview = false,
}: {
  recipe: Recipe;
  image: string | null;
  preview?: boolean;
}) {
  const [servings, setServings] = useState(r.servings);
  const [cook, setCook] = useState(false);
  const [step, setStep] = useState(0);
  const factor = servings / r.servings;
  const active = r.steps[step];
  return (
    <article className="section recipe-detail">
      {preview ? (
        <p className="notice">
          FORHÅNDSVISNING · Denne kladde er kun synlig for dig. Udgivelse sker separat.
        </p>
      ) : null}
      <header className="recipe-heading">
        <div>
          <span className="eyebrow">{r.category} · AF AKSEL SLOT</span>
          <h1>{r.title}</h1>
          <p className="lede">{r.description}</p>
          <div className="recipe-meta">
            <span>{totalTime(r) ? totalTime(r) + ' minutter' : 'Tid ikke angivet'}</span>
            <span>
              {r.servings} {r.yield_unit || 'personer'}
            </span>
            <span>
              {{ easy: 'Let', medium: 'Middel', hard: 'Svær' }[r.difficulty] || 'Fra mit køkken'}
            </span>
          </div>
          <button className="secondary no-print" onClick={() => setCook(!cook)}>
            {cook ? 'Vis hele opskriften' : 'Start trinvis tilberedning'}
          </button>
        </div>
        {image ? (
          <Image
            className="detail-image"
            src={image}
            alt={r.title}
            width={1000}
            height={750}
            unoptimized
          />
        ) : null}
      </header>
      <div className="recipe-columns">
        <aside className="ingredients">
          <span className="eyebrow">DET SKAL DU BRUGE</span>
          <h2>Ingredienser</h2>
          <label className="servings no-print">
            Antal {r.yield_unit || 'personer'}
            <input
              type="number"
              min="1"
              max="1000"
              value={servings}
              onChange={(e) =>
                setServings(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))
              }
            />
          </label>
          <p className="small">Mængder skaleres. Tilberedning og hævetider gør ikke.</p>
          {r.ingredients.map((i, n) => (
            <label className="ingredient" key={n}>
              <input type="checkbox" />
              <span>
                {i.quantity !== null
                  ? new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(
                      i.quantity * factor,
                    ) + ' '
                  : ''}
                {i.unit ? i.unit + ' ' : ''}
                {i.name}
                {i.preparation ? ', ' + i.preparation : ''}
              </span>
            </label>
          ))}
        </aside>
        <div className="method">
          <span className="eyebrow">SÅDAN GØR DU</span>
          <h2>Fremgangsmåde</h2>
          {cook && active ? (
            <div className="cook-step">
              <p>
                Trin {step + 1} af {r.steps.length}
              </p>
              <p className="step-body">{active.body}</p>
              {active.timer_seconds ? (
                <p>Vejledende tid: {Math.round(active.timer_seconds / 60)} min</p>
              ) : null}
              <div className="actions">
                <button
                  className="secondary"
                  disabled={step === 0}
                  onClick={() => setStep(step - 1)}
                >
                  Forrige
                </button>
                <button disabled={step === r.steps.length - 1} onClick={() => setStep(step + 1)}>
                  Næste trin
                </button>
              </div>
            </div>
          ) : (
            <ol className="steps">
              {r.steps.map((s, n) => (
                <li key={n}>
                  <span className="step-number">{n + 1}</span>
                  <div className="step-body">
                    {s.body}
                    {s.timer_seconds ? (
                      <small>Vejledende tid: {Math.round(s.timer_seconds / 60)} min</small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {detailFields.map(([field, title]) =>
            r[field] ? (
              <section className="detail-note" key={field}>
                <h3>{title}</h3>
                <p>{r[field]}</p>
              </section>
            ) : null,
          )}
        </div>
      </div>
    </article>
  );
}

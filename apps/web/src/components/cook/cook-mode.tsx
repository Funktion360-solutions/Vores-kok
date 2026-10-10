'use client';
import { detectTimers, formatAmount, formatTimer, formatYield, ingredientsInStep, scaleFactor, scaleQuantity } from '@vores-kok/domain';
import type { RecipeDocument } from '@vores-kok/validation';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, BellRing, Check, List, Pause, Play, Timer, X } from 'lucide-react';
import Link from 'next/link';
import { advanceTimers, MAX_TIMER_SECONDS, restoreCookSession, type RunningTimer } from '../../../../../packages/validation/src/cook-session';
import { Alert, Button, Field, Input } from '../ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';


function beep() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.4 + 0.3);
      o.start(ctx.currentTime + i * 0.4); o.stop(ctx.currentTime + i * 0.4 + 0.32);
    }
    setTimeout(() => { void ctx.close(); }, 1800);
  } catch { /* audio not available */ }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

/** Keeps the screen on while cooking (Screen Wake Lock API; re-acquired when the tab becomes visible). */
function useWakeLock(active: boolean) {
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        setOn(true);
        lock.addEventListener('release', () => setOn(false));
      } catch { setOn(false); }
      if (cancelled) void lock?.release();
    };
    void acquire();
    const onVis = () => { if (document.visibilityState === 'visible') void acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVis); void lock?.release(); };
  }, [active, supported]);
  return { supported, on };
}

export function CookMode({ recipe, servings }: { recipe: RecipeDocument; servings: number | null }) {
  const steps = recipe.steps;
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState('');
  const [timerName, setTimerName] = useState('');
  const [timerError, setTimerError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const storageKey = `vk:cook:v1:${recipe.household_id}:${recipe.id}:${recipe.version}:${servings ?? 'original'}`;
  const ingredientIds = useMemo(() => recipe.ingredients.map(i => i.id), [recipe.ingredients]);
  const sounded = useRef(new Set<string>());
  const wake = useWakeLock(!finished || timers.some(t => t.endsAt !== null && !t.done));
  const factor = scaleFactor(recipe.servings, servings);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const amounts = useMemo(() => new Map(recipe.ingredients.map((i) => [i.id, formatAmount(scaleQuantity({ quantity: i.quantity, quantityMax: i.quantity_max, unit: i.unit, unitCode: i.unit_code, isScalable: i.is_scalable }, factor))])), [recipe.ingredients, factor]);
  const step = steps[index];
  const stepIngredients = useMemo(() => (step ? ingredientsInStep(step.body, recipe.ingredients) : []), [step, recipe.ingredients]);
  const stepTimers = useMemo(() => {
    if (!step) return [];
    const found = detectTimers(step.body);
    if (step.timer_seconds && !found.some((t) => t.seconds === step.timer_seconds)) found.unshift({ seconds: step.timer_seconds, label: formatTimer(step.timer_seconds) });
    return found;
  }, [step]);

  const go = useCallback((n: number) => {
    if (n >= steps.length) { setFinished(true); return; }
    setIndex(Math.max(0, n));
    setFinished(false);
  }, [steps.length]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const saved = raw ? restoreCookSession(raw, steps.length, ingredientIds) : null;
      if (saved) {
        setIndex(saved.index); setFinished(saved.finished); setChecked(saved.checked); setTimers(saved.timers);
        sounded.current = new Set(saved.timers.filter(t => t.done).map(t => t.id));
        setRestored(true);
      }
    } catch { setStorageError(true); }
    setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey, steps.length, ingredientIds]);

  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), index, finished, checked, timers })); }
    catch {
      const frame = requestAnimationFrame(() => setStorageError(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [loaded, storageKey, index, finished, checked, timers]);

  useEffect(() => { headingRef.current?.focus(); }, [index, finished]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLElement && (target.closest('input, textarea, select, button, a, summary') || target.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  // Absolute deadlines keep the remaining time correct after a sleeping tab resumes.
  const hasRunningTimer = timers.some(t => t.endsAt !== null && !t.done);
  useEffect(() => {
    if (!hasRunningTimer) return;
    const tick = () => setTimers(cur => advanceTimers(cur, Date.now()));
    const h = setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(h); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [hasRunningTimer]);
  useEffect(() => {
    const newlyDone = timers.filter(t => t.done && !sounded.current.has(t.id));
    if (newlyDone.length) { newlyDone.forEach(t => sounded.current.add(t.id)); beep(); }
  }, [timers]);

  const startTimer = (seconds: number, label: string) => {
    if (timers.length >= 20) { setTimerError('Du kan have højst 20 timere. Fjern en timer først.'); return; }
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_TIMER_SECONDS) { setTimerError('Vælg en timer mellem 1 sekund og 7 dage.'); return; }
    setTimerError('');
    setTimers(cur => [...cur, { id: crypto.randomUUID(), label: `Trin ${index + 1}: ${label}`.slice(0, 200), total: seconds, remaining: seconds, endsAt: Date.now() + seconds * 1000, done: false }]);
  };
  const toggleTimer = (id: string) => setTimers(cur => advanceTimers(cur, Date.now()).map(t => t.id !== id || t.done ? t : t.endsAt !== null ? { ...t, endsAt: null } : { ...t, endsAt: Date.now() + t.remaining * 1000 }));
  const resetCooking = () => { setIndex(0); setFinished(false); setChecked([]); setRestored(false); headingRef.current?.focus(); };
  const removeTimer = (id: string) => setTimers((cur) => cur.filter((t) => t.id !== id));

  const ingredientList = (
    <ul className="divide-y divide-line/70">
      {recipe.ingredients.map((i) => {
        const hot = stepIngredients.includes(i);
        return (
          <li key={i.id} className={clsx('grid grid-cols-[6rem_1fr] gap-3 py-2.5 text-lg', hot && 'rounded-lg bg-honey-soft px-2 font-semibold')}>
            <span className="text-right tabular-nums">{amounts.get(i.id)}</span>
            <label className={clsx('flex cursor-pointer items-start gap-3', checked.includes(i.id) && 'text-ink-muted line-through')}><input type="checkbox" className="mt-1.5 size-5 shrink-0 accent-brand" checked={checked.includes(i.id)} onChange={e => setChecked(ids => e.target.checked ? [...ids, i.id] : ids.filter(id => id !== i.id))} /><span>{i.name}{i.preparation ? `, ${i.preparation}` : ''}</span></label>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur sm:px-8">
        <Link href={`/recipes/${recipe.id}`} className="inline-flex min-h-12 items-center gap-2 rounded-full px-3 text-ink-soft hover:bg-sand" aria-label="Afslut kogetilstand">
          <X className="size-6" aria-hidden /> <span className="hidden sm:inline">Afslut</span>
        </Link>
        <div className="min-w-0 text-center">
          <div className="truncate font-display text-lg font-semibold">{recipe.title}</div>
          <div className="text-sm text-ink-muted">{servings ? formatYield(servings, recipe.yield_unit) : ''}{wake.on ? ' · Skærmen holdes tændt' : ''}</div>
        </div>
        <button type="button" onClick={() => setShowIngredients((s) => !s)} aria-expanded={showIngredients}
          className="inline-flex min-h-12 items-center gap-2 rounded-full px-3 text-ink-soft hover:bg-sand lg:invisible">
          <List className="size-6" aria-hidden /> <span className="hidden sm:inline">Ingredienser</span>
        </button>
      </header>

      {restored ? <div className="px-4 py-3 sm:px-8"><Alert tone="success">Dit trin, ingredienser og timere er gendannet fra denne browserfane. <button type="button" className="ml-2 underline" onClick={resetCooking}>Start trinene forfra</button></Alert></div> : null}
      {storageError ? <div className="px-4 py-3 sm:px-8"><Alert tone="info">Browseren kunne ikke gemme fremskridt. Lad siden være åben.</Alert></div> : null}
      <div className="h-2 bg-sand" role="progressbar" aria-label="Fremskridt" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={finished ? steps.length : index + 1}>
        <div className="h-full bg-brand transition-[width]" style={{ width: `${steps.length ? ((finished ? steps.length : index + 1) / steps.length) * 100 : 100}%` }} />
      </div>

      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(320px,420px)_1fr]">
        <aside className={clsx('border-line bg-paper p-6 lg:block lg:border-r', showIngredients ? 'block border-b' : 'hidden')} aria-label="Ingredienser">
          <h2 className="mb-3 text-2xl font-semibold">Ingredienser</h2>
          <p className="mb-3 text-sm text-ink-muted">Afkryds ingredienser, når du har gjort dem klar. {checked.length} af {recipe.ingredients.length} klar.</p>
          {ingredientList}
        </aside>

        <main className="flex flex-1 flex-col px-5 py-8 sm:px-12">
          {finished || steps.length === 0 ? (
            <div className="m-auto max-w-xl text-center">
              <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-sage text-white"><Check className="size-10" /></div>
              <h1 ref={headingRef} tabIndex={-1} className="text-5xl font-semibold">Velbekomme!</h1>
              <p className="mt-3 text-xl text-ink-soft">{steps.length ? `Alle ${steps.length} trin er klaret.` : 'Opskriften har ingen trin.'}</p>
              <div className="mt-8 flex justify-center gap-3">
                {steps.length ? <button type="button" onClick={resetCooking} className="min-h-14 rounded-full border border-line bg-paper px-6 text-lg">Start forfra</button> : null}
                <Link href={`/recipes/${recipe.id}`} className="inline-flex min-h-14 items-center rounded-full bg-brand px-6 text-lg font-medium text-white">Tilbage til opskriften</Link>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
              <p className="text-lg font-medium text-brand-dark">Trin {index + 1} af {steps.length}{step?.section ? ` · ${step.section}` : ''}</p>
              <h1 ref={headingRef} tabIndex={-1} aria-live="polite" className="mt-3 font-display text-[clamp(1.75rem,3.2vw+1rem,2.9rem)] font-medium leading-snug outline-none">{step?.body}</h1>

              {stepIngredients.length ? (
                <div className="mt-8">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">I dette trin</h2>
                  <ul className="flex flex-wrap gap-2">
                    {stepIngredients.map((i) => <li key={i.id} className="rounded-full bg-honey-soft px-4 py-2 text-lg"><span className="font-semibold tabular-nums">{amounts.get(i.id)}</span> {i.name}</li>)}
                  </ul>
                </div>
              ) : null}

              {stepTimers.length ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  {stepTimers.map((t) => (
                    <button key={t.seconds} type="button" onClick={() => startTimer(t.seconds, t.label)}
                      className="inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-brand px-5 text-lg font-medium text-brand-dark hover:bg-brand-soft">
                      <Timer className="size-6" aria-hidden /> Start timer · {formatTimer(t.seconds)}
                    </button>
                  ))}
                </div>
              ) : null}

              <nav aria-label="Trin" className="mt-auto grid grid-cols-2 gap-4 pt-10">
                <button type="button" onClick={() => go(index - 1)} disabled={index === 0}
                  className="inline-flex min-h-20 items-center justify-center gap-3 rounded-2xl border border-line bg-paper text-xl font-medium disabled:opacity-40">
                  <ArrowLeft className="size-7" aria-hidden /> Forrige
                </button>
                <button type="button" onClick={() => go(index + 1)}
                  className="inline-flex min-h-20 items-center justify-center gap-3 rounded-2xl bg-brand text-xl font-semibold text-white hover:bg-brand-dark">
                  {index === steps.length - 1 ? 'Færdig' : 'Næste'} <ArrowRight className="size-7" aria-hidden />
                </button>
              </nav>
            </div>
          )}
        </main>
      </div>

      <section aria-label="Din egen timer" className="border-t border-line bg-paper px-5 py-5 sm:px-8">
        <div className="mx-auto max-w-5xl"><h2 className="text-xl font-semibold">Tilføj din egen timer</h2><form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const seconds = Math.round(Number(timerMinutes.replace(',', '.')) * 60); startTimer(seconds, timerName.trim() || formatTimer(seconds)); }}><Field label="Minutter" htmlFor="cook-timer-minutes"><Input id="cook-timer-minutes" className="max-w-36" value={timerMinutes} inputMode="decimal" onChange={e => setTimerMinutes(e.target.value)} placeholder="Fx 15" /></Field><Field label="Navn (valgfrit)" htmlFor="cook-timer-name"><Input id="cook-timer-name" maxLength={150} value={timerName} onChange={e => setTimerName(e.target.value)} placeholder="Fx efterhævning" /></Field><Button type="submit" disabled={!timerMinutes.trim()}>Start timer</Button></form>{timerError ? <div className="mt-3"><Alert>{timerError}</Alert></div> : null}<p className="mt-3 text-xs text-ink-muted">Fremskridt gemmes i denne browserfane i op til 24 timer. Timere fortsætter ud fra sluttidspunktet, men lyd kan udeblive, når skærmen er låst eller siden er i baggrunden. Brug telefonens alarm, hvis tiden er vigtig. “Start forfra” nulstiller trin og afkrydsninger; aktive timere fortsætter.</p></div>
      </section>
      {timers.length ? (
        <div className="sticky bottom-0 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur" role="region" aria-label="Timere">
          <ul className="mx-auto flex max-w-5xl flex-wrap gap-2">
            {timers.map((t) => (
              <li key={t.id} className={clsx('flex items-center gap-2 rounded-full px-4 py-2', t.done ? 'animate-pulse bg-danger text-white' : 'bg-sand')}>
                {t.done ? <BellRing className="size-5" aria-hidden /> : <Timer className="size-5" aria-hidden />}
                <span className="text-sm">{t.label}</span>
                <span className="font-display text-xl font-semibold tabular-nums" role="timer" aria-live={t.done ? 'assertive' : 'off'}>{t.done ? 'Færdig!' : formatTimer(t.remaining)}</span>
                {!t.done ? <button type="button" onClick={() => toggleTimer(t.id)} className="rounded-full p-2 hover:bg-cream" aria-label={t.endsAt ? 'Pause timer' : 'Genoptag timer'}>{t.endsAt ? <Pause className="size-5" /> : <Play className="size-5" />}</button> : null}
                <button type="button" onClick={() => removeTimer(t.id)} className="rounded-full p-2 hover:bg-cream" aria-label="Fjern timer"><X className="size-5" /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

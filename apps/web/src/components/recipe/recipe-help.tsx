'use client';
import { useId, useState } from 'react';
import { aiReplySchema, aiRequestSchema } from '@vores-kok/validation';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Badge, Button, Card, Field, Spinner, Textarea } from '../ui';
type Turn = { question: string; answer: string };
const questions = ['Forklar fremgangsmåden mere detaljeret, trin for trin.', 'Hvilke fejl skal jeg undgå, og hvordan ser jeg, at retten er færdig?', 'Hvad kan jeg forberede på forhånd?', 'Hvordan opbevarer og genopvarmer jeg retten?'];
export function RecipeHelp({ householdId, recipeId, title }: { householdId: string; recipeId: string; title: string }) {
  const fieldId = useId();
  const [question, setQuestion] = useState(''); const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function send(message = question) {
    if (busy || !message.trim()) return;
    setBusy(true); setError('');
    try {
      const body = aiRequestSchema.parse({ householdId, recipeId, message: message.trim(), history: turns.slice(-4).flatMap(t => [{ role: 'user', content: t.question.slice(0, 6000) }, { role: 'assistant', content: t.answer.slice(0, 6000) }]) });
      const { data, error: fnError } = await getBrowserClient().functions.invoke('ai-assistant', { body, signal: AbortSignal.timeout(75000) });
      if (fnError) {
        const context = 'context' in fnError ? fnError.context : null;
        if (context instanceof Response) { const data = await context.json().catch(() => null); throw new Error(data?.error ?? 'Køkkenhjælperen kunne ikke svare.'); }
        throw new Error('AI svarede ikke inden for tidsgrænsen. Kontrollér forbindelsen og prøv igen.');
      }
      const reply = aiReplySchema.parse(data);
      setTurns(ts => [...ts, { question: message.trim(), answer: reply.answer }]); setQuestion('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Svaret kunne ikke hentes.'); }
    finally { setBusy(false); }
  }
  return <Card className="no-print p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">Hjælp til denne opskrift</h2><p className="mt-1 text-ink-soft">Spørg til {title}, få et trin forklaret eller hjælp til en erstatning.</p></div><Badge tone="brand">AI-køkkenhjælper</Badge></div><p className="mt-3 text-xs leading-relaxed text-ink-muted">Dit spørgsmål, samtalen og denne opskrifts ingredienser og trin sendes til AI. Familiehistorier, billeder og personlige noter deles ikke. Originalen ændres ikke. Samtalen findes kun, mens siden er åben. AI kan tage fejl.</p>
    <div className="mt-5 flex flex-wrap gap-2">{questions.map(q => <Button variant="secondary" size="sm" key={q} disabled={busy} onClick={() => void send(q)}>{q === questions[0] ? 'Uddyb fremgangsmåden' : q === questions[1] ? 'Undgå fejl' : q === questions[2] ? 'Forbered på forhånd' : 'Opbevaring og genopvarmning'}</Button>)}</div>
    <div className="mt-5 space-y-4" aria-live="polite">{turns.map((t, i) => <section key={i} className="rounded-xl border border-line bg-cream p-4"><h3 className="font-sans font-semibold">{t.question}</h3><p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink-soft">{t.answer}</p></section>)}</div>
    <form className="mt-5 space-y-3" onSubmit={e => { e.preventDefault(); void send(); }}><Field label="Dit spørgsmål" htmlFor={fieldId}><Textarea id={fieldId} rows={3} maxLength={2000} value={question} disabled={busy} onChange={e => setQuestion(e.target.value)} placeholder="Fx hvordan laver jeg stræk og fold i trin 3, eller hvad kan jeg bruge i stedet for smør?" /></Field><div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !question.trim()}>{busy ? <><Spinner /> Køkkenhjælperen tænker…</> : 'Spørg om opskriften'}</Button>{turns.length ? <Button variant="ghost" disabled={busy} onClick={() => { setTurns([]); setError(''); }}>Ny samtale</Button> : null}</div></form>{error ? <div className="mt-4"><Alert>{error}</Alert></div> : null}
  </Card>;
}

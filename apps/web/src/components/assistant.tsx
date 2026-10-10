'use client';
import { aiDraftKey, parseAiRecipe } from '@/lib/ai-recipe-draft';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { aiReplySchema, aiRequestSchema, type AiReply } from '@vores-kok/validation';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Badge, Button, Card, Field, Spinner, Textarea } from './ui';
const prompts = [
  { title: 'Ny opskrift', text: 'Lav en helt ny, detaljeret opskrift. Jeg har disse ingredienser: ' },
  { title: 'Hjælp til bagning', text: 'Jeg har brug for hjælp til bagning: ' },
  { title: 'Erstat en ingrediens', text: 'Hvad kan jeg bruge i stedet for denne ingrediens, og hvad ændrer det i opskriften? ' },
  { title: 'Find i kogebogen', text: 'Find en opskrift i familiens kogebog med ' },
];
export function Assistant({ householdId, initialMessage = '' }: { householdId: string; initialMessage?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [turns, setTurns] = useState<{ question: string; reply: AiReply; canDraft: boolean }[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort('unmount'); }, []);
  function createDraft(answer: string) {
    try { parseAiRecipe(answer, householdId); sessionStorage.setItem(aiDraftKey(householdId), answer); router.push('/recipes/new?ai=1'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Udkastet kunne ikke åbnes.'); }
  }
  async function send() {
    if (busy || !message.trim()) return;
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort('timeout'), 75000);
    setBusy(true); setError(''); setStatus('');
    const question = message.trim();
    try {
      const body = aiRequestSchema.parse({ householdId, message: question, history: turns.slice(-4).flatMap(t => [{ role: 'user', content: t.question.slice(0, 6000) }, { role: 'assistant', content: t.reply.answer.slice(0, 6000) }]) });
      const { data, error: fnError } = await getBrowserClient().functions.invoke('ai-assistant', { body, signal: controller.signal });
      if (controller.signal.aborted) { if (controller.signal.reason === 'timeout') throw new Error('Assistenten svarede ikke inden for tidsgrænsen. Prøv igen eller stil et kortere spørgsmål.'); return; }
      if (fnError) {
        const context = 'context' in fnError ? fnError.context : null;
        if (context instanceof Response) { const details = await context.json().catch(() => null); throw new Error(details?.error ?? 'Assistenten kunne ikke svare.'); }
        throw new Error('Kontrollér internetforbindelsen og prøv igen.');
      }
      const reply = aiReplySchema.parse(data);
      let canDraft = false; try { parseAiRecipe(reply.answer, householdId); canDraft = true; } catch { /* General cooking advice is not a recipe draft. */ }
      setTurns(t => [...t, { question, reply, canDraft }].slice(-24)); setMessage('');
    } catch (e) { if (!controller.signal.aborted || controller.signal.reason === 'timeout') setError(e instanceof Error ? e.message : 'Assistenten kunne ikke svare.'); }
    finally { clearTimeout(timer); if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  return <div className="space-y-5"><Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Hvad vil du lave i køkkenet?</h2><p className="mt-2 text-ink-soft">Find en familieopskrift, få hjælp til madlavning eller lav et nyt AI-forslag.</p></div><Badge tone="brand">Din køkkenassistent</Badge></div><p className="mt-3 text-xs leading-relaxed text-ink-muted">Dit spørgsmål og relevante opskrifter sendes til AI. Familiehistorier og billeder deles ikke. Samtalen findes kun, mens siden er åben; de seneste 24 svar vises. AI kan tage fejl.</p><div className="mt-5 flex flex-wrap gap-2">{prompts.map(p => <Button key={p.title} variant="secondary" size="sm" disabled={busy} onClick={() => setMessage(p.text)}>{p.title}</Button>)}</div></Card>
    <div aria-live="polite" className="space-y-4">{turns.map((t, i) => <Card key={i} className="p-5 sm:p-6"><Badge tone="sage">Dit spørgsmål</Badge><h2 className="mt-2 font-sans text-lg font-semibold">{t.question}</h2><p className="mt-4 whitespace-pre-wrap text-[16px] leading-relaxed">{t.reply.answer}</p><div className="mt-5 flex flex-wrap gap-2">{t.canDraft ? <Button variant="soft" onClick={() => createDraft(t.reply.answer)}>Gennemgå som opskriftsudkast</Button> : null}<Button variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(t.reply.answer); setStatus('Svaret er kopieret.'); } catch { setError('Browseren kunne ikke kopiere. Markér og kopiér teksten manuelt.'); } }}>Kopiér svar</Button></div>{t.reply.recipes.length ? <div className="mt-4 border-t border-line pt-3"><p className="text-xs font-medium text-ink-muted">Opskrifter sendt som reference</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{t.reply.recipes.map(r => <Link className="text-sm text-brand-dark underline" key={r.id} href={`/recipes/${r.id}`}>{r.title}</Link>)}</div></div> : null}</Card>)}</div>
    <Card className="p-5 sm:p-6"><form className="space-y-3" onSubmit={e => { e.preventDefault(); void send(); }}><Field label="Spørg Vores Kok AI" htmlFor="ai-message" hint={`${message.length} / 2000 tegn`}><Textarea id="ai-message" rows={5} maxLength={2000} value={message} disabled={busy} onChange={e => setMessage(e.target.value)} placeholder="Jeg har oksekød, løg og pasta. Hvad kan vi lave?" /></Field><div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !message.trim()}>{busy ? <><Spinner /> Assistenten tænker…</> : 'Send spørgsmål'}</Button>{busy ? <Button variant="secondary" onClick={() => { request.current?.abort('user'); setStatus('Ventetiden er afbrudt. Spørgsmålet står stadig i feltet.'); }}>Stop ventetid</Button> : <Button variant="ghost" onClick={() => { setTurns([]); setError(''); setStatus(''); setMessage(''); }}>Ny samtale</Button>}</div></form></Card>
    {status ? <Alert tone="success">{status}</Alert> : null}{error ? <Alert>{error}</Alert> : null}
  </div>;
}

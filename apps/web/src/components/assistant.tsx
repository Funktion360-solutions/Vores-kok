'use client';
import { aiDraftKey, parseAiRecipe } from '@/lib/ai-recipe-draft';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { askAssistant } from '@vores-kok/database';
import { type AiReply } from '@vores-kok/validation';
import { getBrowserClient } from '@/lib/supabase/client';
export function Assistant({ householdId }: { householdId: string }) {
  const router = useRouter();
  function createDraft(answer: string) {
    try {
      parseAiRecipe(answer, householdId);
      sessionStorage.setItem(aiDraftKey(householdId), answer);
      router.push('/recipes/new?ai=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Udkastet kunne ikke åbnes.');
    }
  }
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<{ question: string; reply: AiReply }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    if (busy || !message.trim()) return;
    setBusy(true);
    setError('');
    const question = message.trim();
    try {
      const reply = await askAssistant(getBrowserClient(), {
        householdId,
        message: question,
        history: turns.slice(-4).flatMap((t) => [
          { role: 'user', content: t.question },
          { role: 'assistant', content: t.reply.answer },
        ]),
      });
      setTurns((t) => [...t, { question, reply }]);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assistenten kunne ikke svare.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <p>Spørg om madlavning, bagning eller hvad du kan lave med dine ingredienser.</p>
      <p className="text-sm text-ink-soft">
        Dit spørgsmål og relevante opskrifter sendes til AI-udbyderen. Familiehistorier og billeder
        deles ikke. Samtalen gemmes kun, mens denne side er åben. AI kan tage fejl.
      </p>
      <div aria-live="polite" className="space-y-4">
        {turns.map((t, i) => (
          <section key={i} className="rounded-xl border p-4">
            <h2 className="font-semibold">{t.question}</h2>
            <p className="mt-3 whitespace-pre-wrap">{t.reply.answer}</p>
            <button
              type="button"
              className="mt-4 min-h-12 rounded-full border px-5"
              onClick={() => createDraft(t.reply.answer)}
            >
              Opret opskrift fra AI-svar
            </button>
            {t.reply.recipes.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm">Opskrifter sendt som reference:</p>
                {t.reply.recipes.map((r) => (
                  <Link className="mr-4 underline" key={r.id} href={`/recipes/${r.id}`}>
                    {r.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="space-y-3"
      >
        <label className="block font-semibold" htmlFor="ai-message">
          Spørg Vores Kok AI
        </label>
        <textarea
          id="ai-message"
          className="w-full rounded-xl border p-3"
          rows={4}
          maxLength={2000}
          value={message}
          disabled={busy}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Jeg har oksekød, løg og pasta. Hvad kan vi lave?"
        />
        <button
          className="min-h-12 rounded-full bg-brand px-6 text-white disabled:opacity-50"
          disabled={busy || !message.trim()}
        >
          {busy ? 'Assistenten tænker…' : 'Send spørgsmål'}
        </button>
        <button
          type="button"
          className="ml-4 min-h-12 underline"
          disabled={busy}
          onClick={() => {
            setTurns([]);
            setError('');
          }}
        >
          Ny samtale
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

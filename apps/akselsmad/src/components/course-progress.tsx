'use client';
import { useState } from 'react';
import Link from 'next/link';
export function CourseProgress({
  id,
  chapters,
  initial,
  signedIn,
  path,
  unavailable = false,
}: {
  id: string;
  chapters: { key: string; title: string }[];
  initial: string[];
  signedIn: boolean;
  path: string;
  unavailable?: boolean;
}) {
  const [completed, setCompleted] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function toggle(key: string) {
    setBusy(true);
    setMessage('');
    const done = !completed.includes(key);
    try {
      const response = await fetch('/api/editions/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, chapter: key, completed: done }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Din fremgang kunne ikke gemmes.');
      setCompleted((old) => (done ? [...old, key] : old.filter((k) => k !== key)));
      setMessage(done ? 'Trinnet er gennemført.' : 'Trinnet er markeret som ikke gennemført.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Din fremgang kunne ikke gemmes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="course-progress" aria-label="Din fremgang">
      <span className="eyebrow">TAG DET I DIT TEMPO</span>
      <h2>Din vej gennem køkkenet.</h2>
      {signedIn && !unavailable ? (
        <>
          <p>
            {completed.length} af {chapters.length} trin gennemført
          </p>
          <progress max={chapters.length} value={completed.length} aria-label="Gennemførte trin" />
        </>
      ) : (
        <p>
          {unavailable
            ? 'Din gemte fremgang kunne ikke hentes. Genindlæs siden for at prøve igen.'
            : 'Log ind for at gemme din fremgang og fortsætte på en anden enhed.'}
        </p>
      )}
      {!signedIn ? (
        <Link className="button secondary" href={'/login?next=' + encodeURIComponent(path)}>
          Log ind og gem din fremgang ↗
        </Link>
      ) : null}
      <ol>
        {chapters.map((ch) => (
          <li key={ch.key}>
            <a href={'#kapitel-' + ch.key}>{ch.title}</a>
            {signedIn ? (
              <button
                type="button"
                disabled={busy || unavailable}
                aria-pressed={completed.includes(ch.key)}
                onClick={() => void toggle(ch.key)}
              >
                {completed.includes(ch.key) ? '✓ Gennemført' : 'Markér gennemført'}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </aside>
  );
}

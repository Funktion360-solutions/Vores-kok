'use client';
import { useState } from 'react';
import { browserDb } from '@/lib/client';
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const client = browserDb();
      const result =
        mode === 'password'
          ? await client.auth.signInWithPassword({ email, password })
          : await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (result.error)
        throw new Error('Login mislykkedes. Kontrollér oplysningerne og prøv igen.');
      window.location.assign(next);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Login mislykkedes.');
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    setBusy(true);
    setMessage('');
    const { error } = await browserDb().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setMessage(
      error
        ? 'Koden kunne ikke sendes. Prøv igen senere.'
        : 'Hvis kontoen findes, bliver en kode sendt til din mail.',
    );
    setMode('code');
    setBusy(false);
  }
  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        E-mail
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {mode === 'password' ? (
        <label>
          Adgangskode
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      ) : (
        <label>
          Kode fra din mail
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Indtast hele koden"
          />
        </label>
      )}
      <button disabled={busy}>{busy ? 'Arbejder…' : 'Log ind'}</button>
      <button type="button" className="secondary" disabled={busy || !email} onClick={send}>
        Send en login-kode
      </button>
      <p role="status">{message}</p>
      <p>
        Ny bruger?{' '}
        <a
          href={
            (process.env.NEXT_PUBLIC_VORES_KOK_URL || 'https://voreskok.funktion360.dk') + '/signup'
          }
        >
          Opret din Funktion360-konto via Vores Kok
        </a>
        .
      </p>
    </form>
  );
}

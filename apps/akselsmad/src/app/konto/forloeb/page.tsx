import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { editionPath, type Edition } from '@/lib/editions';
export const metadata: Metadata = {
  title: 'Mine temaforløb',
  robots: { index: false, follow: false },
};
export default async function Page() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login?next=/konto/forloeb');
  const progress: { edition_id: string; chapter_key: string }[] = [];
  for (let start = 0; ; start += 200) {
    const r = await client
      .from('am_course_progress')
      .select('edition_id,chapter_key')
      .eq('user_id', user.id)
      .order('edition_id')
      .order('chapter_key')
      .range(start, start + 199);
    if (r.error) throw new Error('Dine forløb kunne ikke hentes.');
    progress.push(...r.data);
    if (r.data.length < 200) break;
  }
  const ids = [...new Set(progress.map((p) => p.edition_id))];
  const rows: Edition[] = [];
  for (let start = 0; start < ids.length; start += 200) {
    const r = await client
      .from('am_editions')
      .select('*')
      .eq('kind', 'course')
      .eq('visible', true)
      .in('id', ids.slice(start, start + 200));
    if (r.error) throw new Error('Dine forløb kunne ikke hentes.');
    rows.push(...(r.data as Edition[]));
  }
  return (
    <section className="section">
      <Link href="/konto">← Mit køkken</Link>
      <span className="eyebrow">TAG DET I DIT TEMPO</span>
      <h1>Mine temaforløb.</h1>
      <p className="lede">Fortsæt, hvor du slap. Din fremgang gemmes på din Funktion360-konto.</p>
      {rows.length ? (
        <div className="draft-list">
          {rows.map((e) => {
            const completed = e.content.chapters.filter((ch) =>
              progress.some((p) => p.edition_id === e.id && p.chapter_key === ch.key),
            ).length;
            return (
              <Link key={e.id} href={editionPath(e)}>
                <div>
                  <span className="eyebrow">{e.content.category}</span>
                  <h2>{e.content.title}</h2>
                  <p>
                    {completed} af {e.content.chapters.length} trin gennemført
                  </p>
                </div>
                <span>Fortsæt ↗</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <h2>Find dit næste køkkenprojekt.</h2>
          <p>Når du markerer et trin som gennemført, kan du finde forløbet her.</p>
        </div>
      )}
      {ids.length > rows.length ? (
        <p className="muted">Et tidligere forløb er ikke længere offentligt tilgængeligt.</p>
      ) : null}
      <Link className="button" href="/forloeb">
        Se alle temaforløb ↗
      </Link>
    </section>
  );
}

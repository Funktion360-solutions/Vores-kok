import Link from 'next/link';
import type { EditionKind } from '@/lib/editions';
import { editionPath } from '@/lib/editions';
import { editions } from '@/lib/editions-data';
export async function EditionIndex({
  kind,
  params,
}: {
  kind: EditionKind;
  params: { q?: string; category?: string };
}) {
  const all = await editions(kind);
  const course = kind === 'course';
  const q = typeof params.q === 'string' ? params.q.slice(0, 200) : '';
  const category = typeof params.category === 'string' ? params.category : '';
  const rows = all.filter(
    (e) =>
      (!category || e.content.category === category) &&
      (!q ||
        (e.content.title + ' ' + e.content.excerpt + ' ' + e.content.category)
          .toLocaleLowerCase('da')
          .includes(q.toLocaleLowerCase('da'))),
  );
  const categories = [...new Set(all.map((e) => e.content.category))].sort((a, b) =>
    a.localeCompare(b, 'da'),
  );
  return (
    <>
      <header className="edition-index-hero section">
        <span className="eyebrow">PASTA · SALATER · ITALIEN · MADGLÆDE</span>
        <h1>{course ? 'Et nyt kapitel i dit køkken.' : 'Mit køkken, samlet i bøger.'}</h1>
        <p className="lede">
          {course
            ? 'Gå på opdagelse i temaforløb med opskrifter, teknikker og fortællinger. Tag et trin ad gangen, fra italienske middage til salater og brød.'
            : 'Mine digitale kogebøger samler opskrifter, tanker og teknikker omkring et tema. Læs i dit eget tempo, og find inspiration til bordet.'}
        </p>
        <Link href={course ? '/kogeboeger' : '/forloeb'}>
          {course ? 'Se også mine kogebøger' : 'Gå på opdagelse i temaforløb'} ↗
        </Link>
      </header>
      <section className="section">
        <form method="get" className="editorial-filters">
          <label>
            Søg
            <input
              name="q"
              maxLength={200}
              defaultValue={q}
              placeholder="Pasta, salater, gæstemad …"
            />
          </label>
          <label>
            Tema
            <select name="category" defaultValue={category}>
              <option value="">Alle temaer</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button type="submit">Find inspiration</button>
          <Link href={course ? '/forloeb' : '/kogeboeger'}>Nulstil</Link>
        </form>
        {rows.length ? (
          <div className="edition-grid">
            {rows.map((e) => (
              <Link
                className={'edition-card ' + (course ? 'edition-course' : 'edition-book')}
                key={e.id}
                href={editionPath(e)}
              >
                <div className="edition-cover" aria-hidden="true">
                  <span>AKSELSMAD</span>
                  <strong>{e.content.title}</strong>
                  <small>{e.content.category}</small>
                </div>
                <div className="edition-card-copy">
                  <span className="eyebrow">
                    {e.content.category} · {e.content.chapters.length}{' '}
                    {course ? 'TRIN' : 'KAPITLER'}
                  </span>
                  <h2>{e.content.title}</h2>
                  <p>{e.content.excerpt}</p>
                  <span>{course ? 'Se forløbet' : 'Åbn bogen'} ↗</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>
              {all.length
                ? 'Ingen udgivelser matcher.'
                : course
                  ? 'De første forløb er på vej.'
                  : 'De første kogebøger er på vej.'}
            </h2>
            <p>
              {all.length
                ? 'Prøv et andet tema eller søgeord.'
                : 'Jeg samler opskrifter og skriver introduktioner, før udgivelserne bliver tilgængelige her.'}
            </p>
            <Link href="/opskrifter">Find inspiration i opskrifterne ↗</Link>
          </div>
        )}
      </section>
    </>
  );
}

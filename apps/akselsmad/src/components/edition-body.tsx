import Link from 'next/link';
import type { Edition } from '@/lib/editions';
import { editionPath } from '@/lib/editions';
import { editionOptions } from '@/lib/editions-data';
import { db } from '@/lib/supabase';
import { RichText } from './rich-text';
import { CourseProgress } from './course-progress';
export async function EditionBody({
  edition,
  preview = false,
}: {
  edition: Pick<Edition, 'id' | 'kind' | 'slug' | 'content'>;
  preview?: boolean;
}) {
  const c = edition.content;
  const course = edition.kind === 'course';
  const path = editionPath(edition);
  const options = await editionOptions(c.chapters.flatMap((ch) => ch.items));
  const available = new Map(options.map((o) => [o.type + ':' + o.id, o]));
  let signedIn = false;
  let completed: string[] = [];
  let unavailable = false;
  if (course && !preview) {
    const client = await db();
    const auth = await client.auth.getUser();
    signedIn = !!auth.data.user;
    if (auth.error) unavailable = true;
    if (auth.data.user) {
      const result = await client
        .from('am_course_progress')
        .select('chapter_key')
        .eq('user_id', auth.data.user.id)
        .eq('edition_id', edition.id)
        .in(
          'chapter_key',
          c.chapters.map((ch) => ch.key),
        );
      if (result.error) unavailable = true;
      else completed = result.data.map((row) => row.chapter_key as string);
    }
  }
  return (
    <article className={'edition-reading ' + (course ? 'edition-course' : 'edition-book')}>
      <header className="edition-hero">
        <div>
          <Link href={course ? '/forloeb' : '/kogeboeger'}>
            ← {course ? 'Alle temaforløb' : 'Alle kogebøger'}
          </Link>
          <span className="eyebrow">
            {course ? 'ET FORLØB FRA MIT KØKKEN' : 'EN DIGITAL KOGEBOG'} · {c.category}
          </span>
          <h1>{c.title}</h1>
          <p className="lede">{c.excerpt}</p>
          <p>
            Af Aksel Slot · {c.chapters.length} {course ? 'trin' : 'kapitler'}
          </p>
          <a className="button" href={'#kapitel-' + c.chapters[0]?.key}>
            {course ? 'Begynd forløbet' : 'Åbn bogen'} ↗
          </a>
        </div>
        <div className="edition-cover" aria-hidden="true">
          <span>AKSELSMAD</span>
          <strong>{c.title}</strong>
          <small>
            {c.category}
            <br />
            AF AKSEL SLOT
          </small>
        </div>
      </header>
      <div className="section edition-reading-grid">
        <aside className="edition-contents">
          <span className="eyebrow">{course ? 'FORLØBETS TRIN' : 'INDHOLDSFORTEGNELSE'}</span>
          <ol>
            {c.chapters.map((ch, i) => (
              <li key={ch.key}>
                <a href={'#kapitel-' + ch.key}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {ch.title}
                </a>
              </li>
            ))}
          </ol>
          {!course ? (
            <p>
              Bogen læses her på hjemmesiden. Download af enkelte opskrifter følger din kontos
              grænse på fem opskrifter.
            </p>
          ) : null}
        </aside>
        <div className="edition-chapters">
          <div className="edition-introduction">
            <RichText text={c.intro} headingLevel={2} />
          </div>
          {course && !preview ? (
            <CourseProgress
              id={edition.id}
              chapters={c.chapters.map((ch) => ({ key: ch.key, title: ch.title }))}
              initial={completed}
              signedIn={signedIn}
              path={path}
              unavailable={unavailable}
            />
          ) : null}
          {c.chapters.map((ch, i) => (
            <section
              className="edition-chapter"
              id={'kapitel-' + ch.key}
              key={ch.key}
              tabIndex={-1}
            >
              <span className="eyebrow">
                {course ? 'TRIN' : 'KAPITEL'} {String(i + 1).padStart(2, '0')}
              </span>
              <h2>{ch.title}</h2>
              <RichText text={ch.intro} headingLevel={3} />
              <div className="edition-item-list">
                {ch.items.map((item) => {
                  const option = available.get(item.type + ':' + item.id);
                  return option ? (
                    <Link key={item.type + item.id} href={option.href}>
                      <span className="eyebrow">
                        {item.type === 'recipe'
                          ? 'OPSKRIFT'
                          : item.type === 'guide'
                            ? 'GUIDE'
                            : 'FORTÆLLING'}{' '}
                        · {option.category}
                      </span>
                      <h3>{option.title}</h3>
                      <span>Åbn {item.type === 'recipe' ? 'opskriften' : 'artiklen'} ↗</span>
                    </Link>
                  ) : (
                    <p className="muted" key={item.type + item.id}>
                      Et indholdselement er ikke tilgængeligt lige nu.
                    </p>
                  );
                })}
              </div>
              {c.chapters[i + 1] ? (
                <a className="edition-next" href={'#kapitel-' + c.chapters[i + 1]?.key}>
                  Næste {course ? 'trin' : 'kapitel'}: {c.chapters[i + 1]?.title} →
                </a>
              ) : (
                <a className="edition-next" href="#main">
                  Til toppen ↑
                </a>
              )}
            </section>
          ))}
        </div>
      </div>
      {!preview ? (
        <section className="edition-footer section">
          <span className="eyebrow">MADGLÆDEN FORTSÆTTER</span>
          <h2>Fra mit køkken til dit.</h2>
          <p>Få nye opskrifter, guides og nyt om kommende kogebøger i mit nyhedsbrev.</p>
          <Link className="button secondary" href="/nyhedsbrev">
            Følg med fra mit køkken ↗
          </Link>
        </section>
      ) : null}
    </article>
  );
}

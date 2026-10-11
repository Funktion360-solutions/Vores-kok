import Image from 'next/image';
import Link from 'next/link';
import { RichText } from './rich-text';
import { RecipeCard } from './recipe-card';
import { db } from '@/lib/supabase';
import { editorialPhoto, relatedArticles } from '@/lib/editorial-data';
import { ArticleCard } from './article-card';
import { ArticleActions } from './article-actions';
import { readingMinutes, articleOutline, type ArticleContent } from '@/lib/editorial';
import type { PublicRecipe } from '@/lib/model';
export async function ArticleBody({
  content,
  kind,
  publishedAt,
  articleId,
  publicPath,
}: {
  content: ArticleContent;
  kind: 'guide' | 'blog';
  publishedAt?: string;
  articleId?: string;
  publicPath?: string;
}) {
  const outline = articleOutline(content);
  const shareUrl = publicPath
    ? new URL(publicPath, process.env.NEXT_PUBLIC_SITE_URL || 'https://akselsmad.dk').href
    : undefined;
  const paths = [
    ...new Set(
      [
        content.cover_path,
        ...content.blocks.filter((b) => b.type === 'image').map((b) => b.path),
      ].filter(Boolean),
    ),
  ];
  const ids = [...new Set(content.blocks.filter((b) => b.type === 'recipe').map((b) => b.id))];
  const client = await db();
  const [images, recipeResult, related] = await Promise.all([
    Promise.all(paths.map(async (path) => [path, await editorialPhoto(path)] as const)),
    ids.length
      ? client.from('am_recipes').select('*').in('id', ids).eq('visible', true)
      : Promise.resolve({ data: [], error: null }),
    articleId && publicPath ? relatedArticles(articleId, content.category) : Promise.resolve([]),
  ]);
  if (recipeResult.error) throw new Error('Opskriftsboksene kunne ikke hentes.');
  const photos = new Map(images);
  const recipes = new Map((recipeResult.data as PublicRecipe[]).map((r) => [r.id, r]));
  return (
    <article className="section article-page">
      <nav className="article-breadcrumbs" aria-label="Brødkrummer">
        <Link href="/">AkselsMad</Link>
        <span aria-hidden="true">/</span>
        <Link href={kind === 'guide' ? '/guides' : '/blog'}>
          {kind === 'guide' ? 'Guides' : 'Blog'}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{content.title}</span>
      </nav>
      <header className="article-heading" id="article-top">
        <span className="eyebrow">
          {content.category} · CA. {readingMinutes(content)} MIN. LÆSNING
        </span>
        <h1>{content.title}</h1>
        <p className="lede">{content.excerpt}</p>
        <p className="article-byline">
          Af Aksel Slot
          {publishedAt
            ? ' · ' +
              new Date(publishedAt).toLocaleDateString('da-DK', {
                timeZone: 'Europe/Copenhagen',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : ' · Kladdens forhåndsvisning'}
        </p>
        <ArticleActions title={content.title} url={shareUrl} />
      </header>
      {photos.get(content.cover_path) ? (
        <figure className="article-cover">
          <Image
            unoptimized
            width={1200}
            height={800}
            src={photos.get(content.cover_path)!}
            alt={content.cover_alt}
          />
        </figure>
      ) : null}
      <div className={'article-layout' + (outline.length ? ' has-outline' : '')}>
        {outline.length ? (
          <aside className="article-sidebar">
            <nav aria-label="Indholdsfortegnelse">
              <details open>
                <summary>På denne side</summary>
                <ol>
                  {outline.map((heading) => (
                    <li key={heading.id}>
                      <a href={'#' + heading.id}>{heading.title}</a>
                    </li>
                  ))}
                </ol>
              </details>
            </nav>
            <p className="article-sidebar-note">
              Tag det i dit eget tempo.
              <br />
              God fornøjelse i køkkenet.
            </p>
          </aside>
        ) : null}
        <div className="article-reading">
          {content.blocks.map((b, i) =>
            b.type === 'text' ? (
              <RichText
                key={i}
                text={b.text}
                headingLevel={2}
                headingPrefix={'article-heading-' + i + '-'}
              />
            ) : b.type === 'image' ? (
              photos.get(b.path) ? (
                <figure key={i}>
                  <Image
                    unoptimized
                    width={1200}
                    height={800}
                    src={photos.get(b.path)!}
                    alt={b.alt}
                    loading="lazy"
                  />
                  {b.caption ? <figcaption>{b.caption}</figcaption> : null}
                </figure>
              ) : null
            ) : recipes.has(b.id) ? (
              <aside className="article-recipe" key={i}>
                <span className="eyebrow">PRØV DET I KØKKENET</span>
                <RecipeCard recipe={recipes.get(b.id)!} />
              </aside>
            ) : (
              <p className="notice" key={i}>
                Den tilknyttede opskrift er ikke længere offentlig.
              </p>
            ),
          )}
          <footer className="article-author">
            <span className="eyebrow">FRA AKSELS KØKKEN</span>
            <h2>Mad skal være en glæde.</h2>
            <p>
              Jeg deler opskrifter, bagning og italiensk inspiration med plads til de små detaljer.
            </p>
            <Link href="/om">Læs historien bag AkselsMad →</Link>
          </footer>
          <div className="article-backtop">
            <a href="#article-top">Tilbage til toppen ↑</a>
          </div>
        </div>
      </div>
      {related.length ? (
        <section className="article-related" aria-labelledby="article-related-title">
          <span className="eyebrow">FORTSÆT PÅ OPDAGELSE</span>
          <h2 id="article-related-title">Mere om {content.category.toLocaleLowerCase('da')}.</h2>
          <div className="article-grid">
            {related.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      ) : null}
      {publicPath ? (
        <aside className="article-newsletter">
          <div>
            <span className="eyebrow">ET BREV FRA MIT KØKKEN</span>
            <h2>Vil du have mere madglæde?</h2>
            <p>Opskrifter, guides og nyt fra køkkenet i din indbakke.</p>
          </div>
          <Link className="button" href="/nyhedsbrev">
            Læs om nyhedsbrevet →
          </Link>
        </aside>
      ) : null}
    </article>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { RichText } from './rich-text';
import { RecipeCard } from './recipe-card';
import { db } from '@/lib/supabase';
import { editorialPhoto } from '@/lib/editorial-data';
import { readingMinutes, type ArticleContent } from '@/lib/editorial';
import type { PublicRecipe } from '@/lib/model';
export async function ArticleBody({
  content,
  kind,
  publishedAt,
}: {
  content: ArticleContent;
  kind: 'guide' | 'blog';
  publishedAt?: string;
}) {
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
  const [images, recipeResult] = await Promise.all([
    Promise.all(paths.map(async (path) => [path, await editorialPhoto(path)] as const)),
    ids.length
      ? client.from('am_recipes').select('*').in('id', ids).eq('visible', true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recipeResult.error) throw new Error('Opskriftsboksene kunne ikke hentes.');
  const photos = new Map(images);
  const recipes = new Map((recipeResult.data as PublicRecipe[]).map((r) => [r.id, r]));
  return (
    <article className="section article-page">
      <Link href={kind === 'guide' ? '/guides' : '/blog'}>
        ← {kind === 'guide' ? 'Alle guides' : 'Fra mit køkken'}
      </Link>
      <header className="article-heading">
        <span className="eyebrow">
          {content.category} · {readingMinutes(content)} MIN. LÆSNING
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
      <div className="article-reading">
        {content.blocks.map((b, i) =>
          b.type === 'text' ? (
            <RichText key={i} text={b.text} />
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
      </div>
    </article>
  );
}

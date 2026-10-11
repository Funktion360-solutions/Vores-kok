import Image from 'next/image';
import Link from 'next/link';
import { articlePath, readingMinutes, type Article } from '@/lib/editorial';
import { editorialPhoto } from '@/lib/editorial-data';
export async function ArticleCard({ article }: { article: Article }) {
  const image = await editorialPhoto(article.content.cover_path);
  return (
    <Link className="article-card" href={articlePath(article)}>
      {image ? (
        <div className="article-card-image">
          {/* Signed Supabase URLs expire; render the current URL without an image proxy cache. */}
          <Image
            unoptimized
            width={1200}
            height={800}
            src={image}
            alt={article.content.cover_alt}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="article-card-placeholder">
          <span>{article.kind === 'guide' ? 'KØKKENETS HÅNDBOG' : 'FRA MIT KØKKEN'}</span>
        </div>
      )}
      <div className="article-card-copy">
        <span className="eyebrow">
          {article.content.category} · {readingMinutes(article.content)} MIN. LÆSNING
        </span>
        <h3>{article.content.title}</h3>
        <p>{article.content.excerpt}</p>
        <span>Læs {article.kind === 'guide' ? 'guiden' : 'fortællingen'} ↗</span>
      </div>
    </Link>
  );
}

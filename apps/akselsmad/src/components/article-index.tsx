import { articles } from '@/lib/editorial-data';
import { ArticleCard } from './article-card';
export async function ArticleIndex({
  kind,
  q = '',
  category = '',
}: {
  kind: 'guide' | 'blog';
  q?: string;
  category?: string;
}) {
  const all = await articles(kind);
  const term = q.trim().slice(0, 200).toLocaleLowerCase('da');
  const rows = all.filter(
    (a) =>
      (!category || a.content.category === category) &&
      (!term ||
        (a.content.title + ' ' + a.content.excerpt + ' ' + a.content.category)
          .toLocaleLowerCase('da')
          .includes(term)),
  );
  const categories = [...new Set(all.map((a) => a.content.category))].sort();
  return (
    <section className="section editorial-index">
      <span className="eyebrow">
        {kind === 'guide' ? 'KØKKENETS HÅNDBOG' : 'FORTÆLLINGER & MADGLÆDE'}
      </span>
      <h1>{kind === 'guide' ? 'Lær lidt. Lav noget godt.' : 'Fra mit køkken.'}</h1>
      <p className="lede">
        {kind === 'guide'
          ? 'Grundige guides til råvarer, teknikker og bagning. Til at vende tilbage til, når du står i køkkenet.'
          : 'Tanker, forsøg og inspiration fra et køkken med kærlighed til mad, bagning og Italien.'}
      </p>
      <form className="editorial-filters" method="get">
        <label>
          Søg
          <input name="q" defaultValue={q} maxLength={200} placeholder="Fx surdej eller Italien" />
        </label>
        <label>
          Kategori
          <select name="kategori" defaultValue={category}>
            <option value="">Alle kategorier</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button type="submit">Find indhold</button>
        <a href={kind === 'guide' ? '/guides' : '/blog'}>Nulstil</a>
      </form>
      {rows.length ? (
        <>
          <p className="muted">
            {rows.length} {rows.length === 1 ? 'udgivelse' : 'udgivelser'}
          </p>
          <div className="article-grid">
            {rows.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </>
      ) : (
        <div className="empty">
          <h2>{all.length ? 'Ingen udgivelser matcher.' : 'De første udgivelser er på vej.'}</h2>
          <p>
            {all.length
              ? 'Prøv en anden søgning eller kategori.'
              : 'Her kommer gennemgåede guides og fortællinger fra mit køkken.'}
          </p>
        </div>
      )}
    </section>
  );
}

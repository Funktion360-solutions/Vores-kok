import Link from 'next/link';
import { publicRecipes } from '@/lib/data';
import { articles } from '@/lib/editorial-data';
import { ArticleCard } from '@/components/article-card';
import { RecipeCard } from '@/components/recipe-card';
export default async function Home() {
  const [rows, editorial] = await Promise.all([publicRecipes(), articles()]);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">VELKOMMEN TIL MIT KØKKEN</span>
          <h1>
            God mad.
            <br />
            Gode stunder.
            <br />
            <em>Lidt mere Italien.</em>
          </h1>
          <p>
            Her deler jeg glæden ved at lave mad, bage fra bunden og samle mennesker omkring bordet.
            En opskrift ad gangen.
          </p>
          <Link className="button" href="/opskrifter">
            Find noget, du har lyst til at lave ↗
          </Link>
          <span className="hero-signature">Aksel</span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-label">
            MADGLÆDE
            <br />
            FRA BUNDEN
          </div>
          <svg viewBox="0 0 500 500">
            <circle cx="250" cy="250" r="175" fill="#f9f4eb" />
            <circle cx="250" cy="250" r="153" fill="none" stroke="#d8c6a7" strokeWidth="2" />
            <path
              d="M150 281Q129 202 195 168Q270 120 344 182Q389 236 343 306Q277 357 204 330Q163 319 150 281"
              fill="#c18a48"
            />
            <path
              d="M178 254Q231 187 303 180M198 296Q260 218 335 224"
              fill="none"
              stroke="#f6dcaa"
              strokeWidth="15"
              strokeLinecap="round"
            />
            <path
              d="M329 375Q338 300 374 263M348 321l-29-20m32 0 28-7m-37 50-22-20"
              fill="none"
              stroke="#6f8067"
              strokeWidth="5"
            />
          </svg>
          <span className="art-note">Illustration · egne madbilleder kommer til</span>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">NYT FRA KØKKENET</span>
            <h2>Det har jeg lyst til at dele.</h2>
          </div>
          <Link href="/opskrifter">Alle opskrifter ↗</Link>
        </div>
        {rows.length ? (
          <div className="recipe-grid">
            {rows.slice(0, 6).map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>De første opskrifter er på vej.</h3>
            <p>Jeg vælger og gennemgår opskrifterne, før de lander her. Kig snart forbi igen.</p>
          </div>
        )}
      </section>
      <section className="collection-strip">
        <span className="eyebrow">HVAD HAR DU LYST TIL?</span>
        <div>
          {['Bagning', 'Italiensk', 'Hverdagsmad', 'Gæstemad'].map((c, i) => (
            <Link
              key={c}
              href={
                i === 0 ? '/opskrifter?kategori=Boller' : '/opskrifter?q=' + encodeURIComponent(c)
              }
            >
              <span>0{i + 1}</span>
              <h3>{c}</h3>
              <span>↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section editorial-home">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MERE END EN OPSKRIFT</span>
            <h2>Viden, fortællinger og madglæde.</h2>
          </div>
          <div className="block-actions">
            <Link href="/guides">Alle guides ↗</Link>
            <Link href="/blog">Fra mit køkken ↗</Link>
          </div>
        </div>
        {editorial.length ? (
          <div className="article-grid">
            {editorial.slice(0, 3).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <div className="editorial-intro-grid">
            <Link href="/guides">
              <span className="eyebrow">KØKKENETS HÅNDBOG</span>
              <h3>Bliv klogere i køkkenet.</h3>
              <p>Guides til bagning, råvarer og teknikker. De første er på vej.</p>
              <span>Se guides ↗</span>
            </Link>
            <Link href="/blog">
              <span className="eyebrow">FRA MIT KØKKEN</span>
              <h3>Plads til fortællinger.</h3>
              <p>Madglæde, italiensk inspiration og forsøg fra mit køkken.</p>
              <span>Se bloggen ↗</span>
            </Link>
          </div>
        )}
      </section>
      <section className="about-teaser">
        <span className="eyebrow">MENNESKET BAG OPSKRIFTERNE</span>
        <h2>Et køkken fuldt af drømme.</h2>
        <p>
          Jeg hedder Aksel. Jeg drømmer om at blive kok og bager, og jeg har en særlig kærlighed til
          Italien. AkselsMad er mit sted at dele den glæde.
        </p>
        <Link className="button secondary" href="/om">
          Lær mig lidt bedre at kende ↗
        </Link>
      </section>
    </>
  );
}

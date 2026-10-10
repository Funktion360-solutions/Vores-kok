import Image from 'next/image';
import Link from 'next/link';
import type { PublicRecipe } from '@/lib/model';
import { totalTime } from '@/lib/model';
import { photoUrl } from '@/lib/data';
export async function RecipeCard({ recipe }: { recipe: PublicRecipe }) {
  const r = recipe.content;
  const image = await photoUrl(r.cover_path);
  return (
    <Link className="recipe-card" href={'/opskrifter/' + recipe.slug}>
      <div className="recipe-image">
        {image ? (
          <Image src={image} alt={r.title} width={600} height={450} unoptimized />
        ) : (
          <div className="photo-pending">
            <span>Fra mit køkken</span>
            <strong>{r.category || 'Madglæde'}</strong>
            <small>Billede på vej</small>
          </div>
        )}
      </div>
      <div className="card-text">
        <span className="eyebrow">{r.category}</span>
        <h3>{r.title}</h3>
        <p>
          {totalTime(r) ? totalTime(r) + ' min' : 'Tag dig god tid'} · {r.servings}{' '}
          {r.yield_unit || 'personer'}
        </p>
      </div>
    </Link>
  );
}

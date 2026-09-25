'use client';
import { setFavorite, toDataError } from '@vores-kok/database';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { buttonClass } from '../ui';

export function FavoriteButton({ recipeId, initial }: { recipeId: string; initial: boolean }) {
  const router = useRouter();
  const [fav, setFav] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={fav} className={buttonClass(fav ? 'soft' : 'secondary')}
      onClick={() => start(async () => {
        setFav(!fav);
        try {
          await setFavorite(getBrowserClient(), recipeId, !fav);
          router.refresh();
        } catch (e) {
          alert(toDataError(e).message);
        }
      })}>
      <Star className={`size-5 ${fav ? 'fill-honey text-honey' : ''}`} aria-hidden /> {fav ? 'Favorit' : 'Gem som favorit'}
    </button>
  );
}

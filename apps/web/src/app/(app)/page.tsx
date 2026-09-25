import { searchRecipes } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import { ArrowRight, BookOpen, Heart, Plus, Search, Star } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RecipeGrid } from '@/components/recipe/recipe-card';
import { EmptyState, Input, LinkButton } from '@/components/ui';
import { signedUrls } from '@/lib/media';
import { requireHousehold } from '@/lib/session';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('da-DK', { hour: 'numeric', hour12: false, timeZone: 'Europe/Copenhagen' }).format(new Date()));
  if (h < 5) return 'God nat';
  if (h < 10) return 'Godmorgen';
  if (h < 12) return 'God formiddag';
  if (h < 18) return 'God eftermiddag';
  return 'God aften';
}

function Shelf({ title, href, icon, children }: { title: string; href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">{icon}{title}</h2>
        <Link href={href} className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">Se alle <ArrowRight className="size-4" aria-hidden /></Link>
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const { db, household, displayName } = await requireHousehold();
  const [recent, favorites, family] = await Promise.all([
    searchRecipes(db, household.id, { sort: 'updated' }, 6),
    searchRecipes(db, household.id, { favorites: true }, 6),
    searchRecipes(db, household.id, { family: true, sort: 'updated' }, 6),
  ]);
  const urls = await signedUrls(db, [...recent.items, ...favorites.items, ...family.items].map((r) => r.cover_path));
  const first = displayName.split(' ')[0];

  return (
    <>
      <section className="rounded-[calc(var(--radius-card)+6px)] bg-gradient-to-br from-brand-soft via-honey-soft to-sage-soft px-6 py-10 sm:px-10">
        <p className="text-sm font-medium text-brand-dark">{household.name}</p>
        <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">{greeting()}, {first}</h1>
        <p className="mt-2 max-w-xl text-lg text-ink-soft">Hvad skal der på bordet i dag? Jeres kogebog har {recent.total} {recent.total === 1 ? 'opskrift' : 'opskrifter'}.</p>
        <form action="/recipes" className="mt-6 flex max-w-xl gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input name="q" type="search" aria-label="Søg i opskrifter" placeholder="Søg i familiens opskrifter" className="bg-paper pl-11" />
          </div>
          <button type="submit" className="min-h-11 rounded-full bg-ink px-5 font-medium text-cream hover:bg-ink/90">Søg</button>
        </form>
      </section>

      {recent.total === 0 ? (
        <div className="mt-10">
          <EmptyState title="Velkommen til jeres kogebog" icon={<BookOpen className="size-10" />}
            action={can(household.role, 'recipe.create') ? <LinkButton href="/recipes/new"><Plus className="size-5" aria-hidden /> Tilføj første opskrift</LinkButton> : null}>
            Start med den opskrift, familien laver oftest — eller den, der er sværest at huske.
          </EmptyState>
        </div>
      ) : null}

      {favorites.items.length ? (
        <Shelf title="Dine favoritter" href="/recipes?favorites=1" icon={<Star className="size-6 text-honey" aria-hidden />}>
          <RecipeGrid recipes={favorites.items} urls={urls} />
        </Shelf>
      ) : null}
      {family.items.length ? (
        <Shelf title="Fra familien" href="/recipes?family=1" icon={<Heart className="size-6 text-sage" aria-hidden />}>
          <RecipeGrid recipes={family.items} urls={urls} />
        </Shelf>
      ) : null}
      {recent.items.length ? (
        <Shelf title="Senest ændret" href="/recipes?sort=updated" icon={<BookOpen className="size-6 text-brand" aria-hidden />}>
          <RecipeGrid recipes={recent.items} urls={urls} />
        </Shelf>
      ) : null}
    </>
  );
}

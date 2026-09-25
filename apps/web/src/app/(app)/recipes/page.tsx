import { listCategories, listPeople, listTags, PAGE_SIZE, searchRecipes } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import { filtersToSearchParams, parseRecipeFilters } from '@vores-kok/validation';
import { BookOpen, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RecipeFilterBar } from '@/components/recipe/filter-bar';
import { RecipeGrid } from '@/components/recipe/recipe-card';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { signedUrls } from '@/lib/media';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Opskrifter' };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, household } = await requireHousehold();
  const filters = parseRecipeFilters(await searchParams);
  const [{ items, total }, categories, tags, people] = await Promise.all([
    searchRecipes(db, household.id, filters),
    listCategories(db, household.id),
    listTags(db, household.id),
    listPeople(db, household.id),
  ]);
  const urls = await signedUrls(db, items.map((r) => r.cover_path));
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/recipes?${filtersToSearchParams({ ...filters, page: p }).toString()}`;
  const filtered = total > 0 || Object.values(filters).some((v) => v !== undefined);

  return (
    <>
      <PageHeader
        title="Opskrifter"
        subtitle={total === 1 ? '1 opskrift' : `${total} opskrifter`}
        actions={can(household.role, 'recipe.create') ? <LinkButton href="/recipes/new"><Plus className="size-5" aria-hidden /> Ny opskrift</LinkButton> : null}
      />
      <RecipeFilterBar filters={filters} categories={categories} tags={tags} people={people} />
      <div className="mt-6">
        {items.length ? (
          <RecipeGrid recipes={items} urls={urls} />
        ) : filtered ? (
          <EmptyState title="Ingen opskrifter matcher" icon={<BookOpen className="size-10" />} action={<LinkButton href="/recipes" variant="secondary">Nulstil filtre</LinkButton>}>
            Prøv et andet søgeord eller færre filtre.
          </EmptyState>
        ) : (
          <EmptyState title="Kogebogen er tom" icon={<BookOpen className="size-10" />}
            action={can(household.role, 'recipe.create') ? <LinkButton href="/recipes/new">Tilføj den første opskrift</LinkButton> : null}>
            Skriv familiens første opskrift ind — eller flyt dem over fra Mors Opskrifter.
          </EmptyState>
        )}
      </div>
      {pages > 1 ? (
        <nav aria-label="Sider" className="mt-8 flex items-center justify-center gap-2">
          {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-full px-4 py-2 hover:bg-sand">← Forrige</Link> : null}
          <span className="text-sm text-ink-muted">Side {page} af {pages}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="rounded-full px-4 py-2 hover:bg-sand">Næste →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}

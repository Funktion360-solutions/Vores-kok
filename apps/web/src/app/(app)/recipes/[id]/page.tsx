import { getRecipe, listPeople, listShoppingLists } from '@vores-kok/database';
import {
  can,
  DIFFICULTY_LABELS,
  formatDate,
  formatMinutes,
  formatYear,
  formatYield,
  MEAL_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  totalMinutes,
  type MealType,
} from '@vores-kok/domain';
import { ChefHat, Clock, ExternalLink, Heart, Timer, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CategoryIcon } from '@/components/recipe/category-icon';
import { FavoriteButton } from '@/components/recipe/favorite-button';
import { IngredientsPanel } from '@/components/recipe/ingredients-panel';
import { KitchenActions } from '@/components/recipe/kitchen-actions';
import { ServingsProvider } from '@/components/recipe/servings-context';
import { MediaSection } from '@/components/recipe/media-section';
import { NotesSection } from '@/components/recipe/notes-section';
import { RecipeActions } from '@/components/recipe/recipe-actions';
import { StoriesSection } from '@/components/recipe/stories-section';
import { Badge, Card } from '@/components/ui';
import { signedUrls } from '@/lib/media';
import { requireHousehold } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: 'Opskrift' };
  const { db } = await requireHousehold();
  const r = await getRecipe(db, id).catch(() => null);
  return { title: r?.title ?? 'Opskrift' };
}

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ servings?: string }> }) {
  const { id } = await params;
  const wanted = Number((await searchParams).servings);
  if (!UUID.test(id)) notFound();
  const { db, household, user } = await requireHousehold();
  const recipe = await getRecipe(db, id);
  if (!recipe) notFound();

  // A recipe may belong to another of the user's households; use its role there.
  const role = recipe.household_id === household.id ? household.role : null;
  const canEdit = can(role, 'recipe.edit');
  const [people, lists] = await Promise.all([canEdit ? listPeople(db, recipe.household_id) : Promise.resolve([]), canEdit ? listShoppingLists(db, recipe.household_id) : Promise.resolve([])]);
  const initialServings = Number.isInteger(wanted) && wanted > 0 && wanted <= 1000 ? wanted : recipe.servings;
  const urls = await signedUrls(db, recipe.media.map((m) => m.storage_path));
  const cover = recipe.media.find((m) => m.is_cover && m.mime_type.startsWith('image/')) ?? recipe.media.find((m) => m.kind === 'photo' && m.mime_type.startsWith('image/'));
  const photos = recipe.media.filter((m) => m.kind === 'photo' || m.kind === 'document');
  const heritage = recipe.media.filter((m) => m.kind === 'original_scan' || m.kind === 'historical_photo');
  const total = totalMinutes(recipe);
  const origin = recipe.origin_person?.name ?? recipe.origin_text;

  return (
    <ServingsProvider initial={initialServings}>
    <article className="flex flex-col gap-10">
      {/* ── Hero ── */}
      <header className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Link href="/recipes" className="no-print hover:text-ink">← Opskrifter</Link>
            {recipe.category ? <><span aria-hidden>·</span><span className="flex items-center gap-1"><CategoryIcon icon={recipe.category.icon} className="size-4" />{recipe.category.name}</span></> : null}
            {recipe.archived_at ? <Badge>Arkiveret</Badge> : null}
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{recipe.title}</h1>
          {origin ? (
            <p className="mt-3 flex items-center gap-2 text-lg text-sage">
              <Heart className="size-5" aria-hidden /> Fra {origin}{recipe.origin_person?.relation && recipe.origin_person.relation !== origin ? ` (${recipe.origin_person.relation})` : ''}
              {recipe.origin_year ? <span className="text-ink-muted">· {formatYear(recipe.origin_year, recipe.origin_year_approx)}</span> : null}
            </p>
          ) : null}
          {recipe.description ? <p className="mt-4 max-w-2xl whitespace-pre-wrap text-lg leading-relaxed text-ink-soft">{recipe.description}</p> : null}
          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {recipe.prep_minutes != null ? <div className="flex items-center gap-2"><Timer className="size-4 text-brand" aria-hidden /><dt className="text-ink-muted">Forberedelse</dt><dd className="font-medium">{formatMinutes(recipe.prep_minutes)}</dd></div> : null}
            {recipe.cook_minutes != null ? <div className="flex items-center gap-2"><ChefHat className="size-4 text-brand" aria-hidden /><dt className="text-ink-muted">Tilberedning</dt><dd className="font-medium">{formatMinutes(recipe.cook_minutes)}</dd></div> : null}
            {total ? <div className="flex items-center gap-2"><Clock className="size-4 text-brand" aria-hidden /><dt className="text-ink-muted">I alt</dt><dd className="font-medium">{formatMinutes(total)}</dd></div> : null}
            {recipe.servings ? <div className="flex items-center gap-2"><Users className="size-4 text-brand" aria-hidden /><dt className="sr-only">Mængde</dt><dd className="font-medium">{formatYield(recipe.servings, recipe.yield_unit)}</dd></div> : null}
            {recipe.difficulty ? <div className="flex items-center gap-2"><dt className="text-ink-muted">Sværhedsgrad</dt><dd className="font-medium">{DIFFICULTY_LABELS[recipe.difficulty]}</dd></div> : null}
          </dl>
          {recipe.tags.length || recipe.meal_types.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {recipe.meal_types.map((m) => <Badge key={m} tone="sage">{MEAL_TYPE_LABELS[m as MealType] ?? m}</Badge>)}
              {recipe.tags.map((t) => <Badge key={t.id}>#{t.name}</Badge>)}
            </div>
          ) : null}
          <div className="no-print mt-6">
            <KitchenActions recipeId={recipe.id} title={recipe.title} householdId={recipe.household_id} canEdit={canEdit}
              lists={lists.map((l) => ({ id: l.id, name: l.name }))} hasSteps={recipe.steps.length > 0} />
          </div>
          <div className="no-print mt-3 flex flex-wrap gap-2">
            {role ? <FavoriteButton recipeId={recipe.id} initial={recipe.is_favorite} /> : null}
            <RecipeActions recipeId={recipe.id} title={recipe.title} canEdit={canEdit} canDelete={can(role, 'recipe.delete')} archived={!!recipe.archived_at} />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          {cover && urls[cover.storage_path] ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={urls[cover.storage_path]} alt={cover.caption ?? recipe.title} className="aspect-[4/3] w-full rounded-[var(--radius-card)] object-cover shadow-sm" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[var(--radius-card)] bg-gradient-to-br from-brand-soft to-honey-soft text-brand/60">
              <CategoryIcon icon={recipe.category?.icon} className="size-20" />
            </div>
          )}
        </div>
      </header>

      {/* ── Ingredients + steps (side by side on large screens / iPad landscape) ── */}
      <div className="grid gap-10 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5 sm:p-6">
            <IngredientsPanel ingredients={recipe.ingredients} servings={recipe.servings} yieldUnit={recipe.yield_unit} />
          </Card>
        </div>
        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="mb-4 text-2xl font-semibold">Fremgangsmåde</h2>
          {recipe.steps.length === 0 ? <p className="text-ink-muted">Ingen trin endnu.</p> : null}
          <ol className="flex flex-col gap-5">
            {recipe.steps.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[2.5rem_1fr] gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft font-display font-semibold text-brand-dark" aria-hidden>{i + 1}</span>
                <div>
                  {s.section && s.section !== recipe.steps[i - 1]?.section ? <h3 className="mb-1 font-display text-lg font-semibold text-ink-soft">{s.section}</h3> : null}
                  <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{s.body}</p>
                  {s.timer_seconds ? <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted"><Timer className="size-3.5" aria-hidden /> {formatMinutes(Math.round(s.timer_seconds / 60))}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          {recipe.notes ? (
            <div className="mt-8 rounded-xl border-l-4 border-honey bg-honey-soft/60 p-5">
              <h3 className="mb-1 font-display text-lg font-semibold">Gode råd</h3>
              <p className="whitespace-pre-wrap leading-relaxed">{recipe.notes}</p>
            </div>
          ) : null}
        </section>
      </div>

      {/* ── Family history ── */}
      <div className="grid gap-10 lg:grid-cols-2">
        <StoriesSection stories={recipe.stories} recipeId={recipe.id} householdId={recipe.household_id} people={people} canEdit={canEdit} />
        <MediaSection title="Originaler og gamle billeder" defaultKind="original_scan" recipeId={recipe.id} householdId={recipe.household_id} media={heritage} urls={urls} canEdit={canEdit} />
      </div>

      <MediaSection title="Billeder af retten" defaultKind="photo" recipeId={recipe.id} householdId={recipe.household_id} media={photos} urls={urls} canEdit={canEdit} />

      <div className="grid gap-10 lg:grid-cols-2">
        <NotesSection notes={recipe.notes_personal} recipeId={recipe.id} householdId={recipe.household_id} userId={user.id} canShare={can(role, 'note.share')} />
        <section aria-labelledby="prov-heading">
          <h2 id="prov-heading" className="mb-4 text-2xl font-semibold">Oprindelse</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-muted">Kilde</dt><dd>{SOURCE_TYPE_LABELS[recipe.source_type]}{recipe.source_name ? ` · ${recipe.source_name}` : ''}</dd>
            {recipe.source_url ? (<><dt className="text-ink-muted">Link</dt><dd><a href={recipe.source_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand hover:underline">{new URL(recipe.source_url).hostname}<ExternalLink className="size-3.5" aria-hidden /></a></dd></>) : null}
            {recipe.legacy_author ? (<><dt className="text-ink-muted">Forfatter</dt><dd>{recipe.legacy_author}</dd></>) : null}
            {recipe.legacy_last_modified ? (<><dt className="text-ink-muted">Sidst ændret i Mors Opskrifter</dt><dd>{formatDate(recipe.legacy_last_modified)}</dd></>) : null}
            <dt className="text-ink-muted">Tilføjet</dt><dd>{formatDate(recipe.created_at)}{recipe.created_by_name ? ` af ${recipe.created_by_name}` : ''}</dd>
            <dt className="text-ink-muted">Senest ændret</dt><dd>{formatDate(recipe.updated_at)}{recipe.updated_by_name ? ` af ${recipe.updated_by_name}` : ''}</dd>
            <dt className="text-ink-muted">Versioner</dt><dd><Link href={`/recipes/${recipe.id}/history`} className="text-brand hover:underline">{recipe.version_count + 1} {recipe.version_count ? '— se historik' : ''}</Link></dd>
          </dl>
          {recipe.source_text ? (
            <details className="mt-4 rounded-xl border border-line bg-paper p-4 text-sm">
              <summary className="cursor-pointer font-medium">Original tekst</summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-ink-soft">{recipe.source_text}</pre>
            </details>
          ) : null}
        </section>
      </div>
    </article>
    </ServingsProvider>
  );
}

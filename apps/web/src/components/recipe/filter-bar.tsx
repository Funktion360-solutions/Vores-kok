'use client';
import type { Category, Person, Tag } from '@vores-kok/database';
import { DIFFICULTIES, DIFFICULTY_LABELS, MEAL_TYPES, MEAL_TYPE_LABELS } from '@vores-kok/domain';
import { activeFilterCount, filtersToSearchParams, type RecipeFilters } from '@vores-kok/validation';
import clsx from 'clsx';
import { Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Button, Input, Select } from '../ui';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx('min-h-9 rounded-full border px-3 text-sm transition-colors',
        active ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-paper text-ink-soft hover:bg-sand')}>
      {children}
    </button>
  );
}

function toggle<T>(list: T[] | undefined, v: T): T[] | undefined {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
}

export function RecipeFilterBar({ filters, categories, tags, people }: { filters: RecipeFilters; categories: Category[]; tags: Tag[]; people: Person[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q ?? '');
  const [open, setOpen] = useState(activeFilterCount(filters) > 0);
  const [ingredient, setIngredient] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const apply = (next: RecipeFilters) => {
    const qs = filtersToSearchParams({ ...next, page: undefined }).toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if ((filters.q ?? '') === q) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ ...filters, q: q || undefined }), 300);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on text only
  }, [q]);

  const count = activeFilterCount(filters);

  return (
    <section aria-label="Søg og filtrér" className="no-print flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <label htmlFor="recipe-search" className="sr-only">Søg i opskrifter</label>
          <Input id="recipe-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg efter titel, ingrediens, person…" className="pl-11" autoComplete="off" />
        </div>
        <Button variant={count ? 'soft' : 'secondary'} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="filter-panel">
          <SlidersHorizontal className="size-5" aria-hidden /> Filtre{count ? ` (${count})` : ''}
        </Button>
        <Chip active={!!filters.favorites} onClick={() => apply({ ...filters, favorites: filters.favorites ? undefined : true })}>
          <span className="flex items-center gap-1.5"><Star className="size-4" aria-hidden /> <span className="hidden sm:inline">Favoritter</span></span>
        </Chip>
      </div>

      {open ? (
        <div id="filter-panel" className={clsx('grid gap-5 rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-5', pending && 'opacity-70')}>
          {categories.length ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Kategori</legend>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => <Chip key={c.id} active={!!filters.category?.includes(c.id)} onClick={() => apply({ ...filters, category: toggle(filters.category, c.id) })}>{c.name}</Chip>)}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Måltid</legend>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((m) => <Chip key={m} active={!!filters.meal?.includes(m)} onClick={() => apply({ ...filters, meal: toggle(filters.meal, m) })}>{MEAL_TYPE_LABELS[m]}</Chip>)}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-3">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Sværhedsgrad</legend>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => <Chip key={d} active={!!filters.difficulty?.includes(d)} onClick={() => apply({ ...filters, difficulty: toggle(filters.difficulty, d) })}>{DIFFICULTY_LABELS[d]}</Chip>)}
              </div>
            </fieldset>
            <div>
              <label htmlFor="f-time" className="mb-2 block text-sm font-medium">Samlet tid</label>
              <Select id="f-time" value={filters.maxTime ?? ''} onChange={(e) => apply({ ...filters, maxTime: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Ligegyldigt</option>
                <option value="20">Højst 20 min</option>
                <option value="30">Højst 30 min</option>
                <option value="45">Højst 45 min</option>
                <option value="60">Højst 1 time</option>
                <option value="120">Højst 2 timer</option>
              </Select>
            </div>
            <div>
              <label htmlFor="f-sort" className="mb-2 block text-sm font-medium">Sortering</label>
              <Select id="f-sort" value={filters.sort ?? ''} onChange={(e) => apply({ ...filters, sort: (e.target.value || undefined) as RecipeFilters['sort'] })}>
                <option value="">{filters.q ? 'Bedste match' : 'Alfabetisk'}</option>
                <option value="title">Alfabetisk</option>
                <option value="updated">Senest ændret</option>
                <option value="time">Hurtigst først</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <span className="mb-2 block text-sm font-medium" id="ing-label">Indeholder ingredienser</span>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = ingredient.trim(); if (v) { apply({ ...filters, ingredients: [...new Set([...(filters.ingredients ?? []), v])] }); setIngredient(''); } }}>
                <Input aria-labelledby="ing-label" value={ingredient} onChange={(e) => setIngredient(e.target.value)} placeholder="Fx kylling" />
                <Button type="submit" variant="secondary">Tilføj</Button>
              </form>
              {filters.ingredients?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {filters.ingredients.map((i) => (
                    <button key={i} type="button" onClick={() => apply({ ...filters, ingredients: toggle(filters.ingredients, i) })}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full bg-sage-soft px-3 text-sm text-sage" aria-label={`Fjern ${i}`}>
                      {i} <X className="size-3.5" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Familie</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={!!filters.family} onClick={() => apply({ ...filters, family: filters.family ? undefined : true })}>Har familiehistorie</Chip>
                <Chip active={!!filters.archived} onClick={() => apply({ ...filters, archived: filters.archived ? undefined : true })}>Vis arkiverede</Chip>
              </div>
              {people.length ? (
                <Select aria-label="Fra person" value={filters.person ?? ''} onChange={(e) => apply({ ...filters, person: e.target.value || undefined })}>
                  <option value="">Fra alle personer</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              ) : null}
            </div>
          </div>
          {tags.length ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Tags</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => <Chip key={t.id} active={!!filters.tag?.includes(t.id)} onClick={() => apply({ ...filters, tag: toggle(filters.tag, t.id) })}>#{t.name}</Chip>)}
              </div>
            </fieldset>
          ) : null}
          {count ? <div><Button variant="ghost" size="sm" onClick={() => apply({ q: filters.q })}>Ryd filtre</Button></div> : null}
        </div>
      ) : null}
    </section>
  );
}

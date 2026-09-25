import { listPlanEntries, listShoppingLists, searchRecipes } from '@vores-kok/database';
import { addDays, can, HOME_TIME_ZONE, formatWeekLabel, startOfWeek, todayKey } from '@vores-kok/domain';
import type { Metadata } from 'next';
import { PlanBoard } from '@/components/plan/plan-board';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Madplan' };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { db, household } = await requireHousehold();
  const { week } = await searchParams;
  const start = startOfWeek(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : todayKey(new Date(), HOME_TIME_ZONE));
  const end = addDays(start, 6);
  const [entries, recipes, lists] = await Promise.all([
    listPlanEntries(db, household.id, start, end),
    searchRecipes(db, household.id, { sort: 'title' }, 200),
    listShoppingLists(db, household.id),
  ]);
  return (
    <PlanBoard
      householdId={household.id}
      weekStart={start}
      weekLabel={formatWeekLabel(start)}
      entries={entries}
      recipes={recipes.items.map((r) => ({ id: r.id, title: r.title, servings: r.servings }))}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      canEdit={can(household.role, 'recipe.edit')}
      today={todayKey(new Date(), HOME_TIME_ZONE)}
    />
  );
}

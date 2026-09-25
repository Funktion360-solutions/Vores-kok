import { listPantryItems, listPantryLocations } from '@vores-kok/database';
import { can, HOME_TIME_ZONE, todayKey } from '@vores-kok/domain';
import type { Metadata } from 'next';
import { PantryView } from '@/components/kitchen/pantry-view';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Mit køkken' };

export default async function KitchenPage() {
  const { db, household } = await requireHousehold();
  const [locations, items] = await Promise.all([listPantryLocations(db, household.id), listPantryItems(db, household.id)]);
  return <PantryView householdId={household.id} locations={locations} items={items} canEdit={can(household.role, 'recipe.edit')} today={todayKey(new Date(), HOME_TIME_ZONE)} />;
}

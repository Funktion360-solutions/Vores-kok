import { listShoppingItems } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShoppingListView } from '@/components/shopping/shopping-list-view';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Indkøbsliste' };

export default async function ShoppingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db, household } = await requireHousehold();
  const { data: list } = await db.from('shopping_lists').select('*').eq('id', id).maybeSingle();
  if (!list) notFound();
  const items = await listShoppingItems(db, id);
  return <ShoppingListView list={list} initialItems={items} canEdit={list.household_id === household.id && can(household.role, 'recipe.edit')} />;
}

import { listShoppingLists } from '@vores-kok/database';
import { can, formatDate } from '@vores-kok/domain';
import { ShoppingBasket } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NewListForm } from '@/components/shopping/new-list-form';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Indkøb' };

export default async function ShoppingPage() {
  const { db, household } = await requireHousehold();
  const lists = await listShoppingLists(db, household.id);
  const canEdit = can(household.role, 'recipe.edit');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Indkøb" subtitle="Fælles lister, der opdateres live hos alle i husstanden." />
      {canEdit ? <NewListForm householdId={household.id} /> : null}
      {lists.length === 0 ? (
        <div className="mt-6"><EmptyState title="Ingen indkøbslister" icon={<ShoppingBasket className="size-10" />}>Opret en liste, eller lav en fra madplanen eller en opskrift.</EmptyState></div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/shopping/${l.id}`}>
                <Card className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-sand">
                  <div>
                    <h2 className="font-display text-xl font-semibold">{l.name}</h2>
                    <p className="text-sm text-ink-muted">Opdateret {formatDate(l.updated_at)}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-brand-dark">{l.open_count}</div>
                    <div className="text-xs text-ink-muted">{l.open_count === 1 ? 'vare mangler' : 'varer mangler'} · {l.total_count} i alt</div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

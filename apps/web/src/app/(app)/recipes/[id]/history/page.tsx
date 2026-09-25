import { getRecipe, listRecipeVersions } from '@vores-kok/database';
import { formatAmount, formatDate } from '@vores-kok/domain';
import { recipeDocumentSchema } from '@vores-kok/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, PageHeader } from '@/components/ui';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Historik' };

const snapshotSchema = recipeDocumentSchema.pick({ title: true, servings: true, ingredients: true, steps: true, updated_by_name: true, updated_at: true }).partial();

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireHousehold();
  const recipe = await getRecipe(db, id);
  if (!recipe) notFound();
  const versions = await listRecipeVersions(db, id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Historik" eyebrow={<Link href={`/recipes/${id}`} className="hover:text-ink">← {recipe.title}</Link>}
        subtitle="Hver gang opskriften gemmes, bevares den forrige udgave her." />
      <ol className="flex flex-col gap-4">
        <li>
          <Card className="border-brand/40 p-5">
            <div className="text-sm font-medium text-brand">Nuværende version ({recipe.version})</div>
            <div className="text-sm text-ink-muted">{formatDate(recipe.updated_at)}{recipe.updated_by_name ? ` · ${recipe.updated_by_name}` : ''}</div>
          </Card>
        </li>
        {versions.map((v) => {
          const s = snapshotSchema.safeParse(v.snapshot);
          const snap = s.success ? s.data : {};
          return (
            <li key={v.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-display text-lg font-semibold">Version {v.version}: {snap.title}</div>
                  <div className="text-sm text-ink-muted">Erstattet {formatDate(v.created_at)}</div>
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-ink-soft">Vis indhold</summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <ul className="flex flex-col gap-1">
                      {(snap.ingredients ?? []).map((i) => <li key={i.id}><span className="font-medium">{formatAmount({ quantity: i.quantity, quantityMax: i.quantity_max, unit: i.unit })}</span> {i.name}</li>)}
                    </ul>
                    <ol className="list-decimal pl-5">
                      {(snap.steps ?? []).map((st) => <li key={st.id} className="mb-1">{st.body}</li>)}
                    </ol>
                  </div>
                </details>
              </Card>
            </li>
          );
        })}
        {versions.length === 0 ? <p className="text-ink-muted">Opskriften er ikke blevet ændret endnu.</p> : null}
      </ol>
    </div>
  );
}

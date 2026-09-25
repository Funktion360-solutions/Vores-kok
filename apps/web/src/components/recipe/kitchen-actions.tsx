'use client';
import { todayKey } from '@vores-kok/domain';
import { CalendarPlus, ChefHat, ShoppingBasket } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AddToListDialog } from '../add-to-list-dialog';
import { Dialog } from '../dialog';
import { EntryForm } from '../plan/plan-board';
import { Alert, Button, buttonClass } from '../ui';
import { useServings } from './servings-context';

export function KitchenActions({ recipeId, title, householdId, canEdit, lists, hasSteps }: {
  recipeId: string; title: string; householdId: string; canEdit: boolean; lists: Array<{ id: string; name: string }>; hasSteps: boolean;
}) {
  const { servings } = useServings();
  const [shop, setShop] = useState(false);
  const [plan, setPlan] = useState(false);
  const [planned, setPlanned] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {hasSteps ? (
        <Link href={`/cook/${recipeId}${servings ? `?servings=${servings}` : ''}`} className={buttonClass('primary', 'lg')}>
          <ChefHat className="size-5" aria-hidden /> Start kogetilstand
        </Link>
      ) : null}
      {canEdit ? (
        <>
          <Button variant="secondary" onClick={() => setPlan(true)}><CalendarPlus className="size-4" aria-hidden /> Til madplan</Button>
          <Button variant="secondary" onClick={() => setShop(true)}><ShoppingBasket className="size-4" aria-hidden /> Til indkøbsliste</Button>
        </>
      ) : null}
      {planned ? <Alert tone="success">Sat på madplanen. <Link href="/plan" className="underline">Se madplan</Link></Alert> : null}
      <AddToListDialog open={shop} onClose={() => setShop(false)} householdId={householdId} lists={lists} source={{ kind: 'recipe', recipeId, servings, title }} />
      <Dialog open={plan} onClose={() => setPlan(false)} title="Sæt på madplanen">
        {plan ? <EntryForm householdId={householdId} date={todayKey()} recipes={[{ id: recipeId, title, servings }]} presetRecipeId={recipeId} presetServings={servings}
          onDone={() => { setPlan(false); setPlanned(true); }} /> : null}
      </Dialog>
    </div>
  );
}

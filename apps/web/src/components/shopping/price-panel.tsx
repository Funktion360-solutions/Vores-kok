'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ShoppingItem } from '@vores-kok/database';
import { commerceDb, itemSignature, priceSchema, type ShoppingPrice } from '@/lib/commerce-client';
import { money, parseOre } from '../../../../../packages/validation/src/commerce';
import { Alert, Button, Card, Field, Input, Select } from '../ui';
export function PricePanel({
  items,
  householdId,
  canEdit,
}: {
  items: ShoppingItem[];
  householdId: string;
  canEdit: boolean;
}) {
  const [prices, setPrices] = useState<ShoppingPrice[]>([]),
    [selected, setSelected] = useState(''),
    [store, setStore] = useState(''),
    [price, setPrice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      const { data, error } = await commerceDb()
        .from('vk_shopping_prices')
        .select('*')
        .eq('household_id', householdId);
      if (!alive) return;
      if (error) {
        setError('Priser kunne ikke hentes. Kontrollér at indkøbsdatabasen er installeret.');
        return;
      }
      const rows = priceSchema.array().safeParse(data);
      if (rows.success) setPrices(rows.data);
    }
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [householdId]);
  const byId = new Map(prices.map((p) => [p.item_id, p]));
  const open = items.filter((i) => !i.checked);
  const known = open.flatMap((i) => {
    const p = byId.get(i.id);
    return p?.total_ore != null && p.item_signature === itemSignature(i)
      ? [{ item: i, price: p }]
      : [];
  });
  const groups = new Map<string, { sum: number; count: number }>();
  for (const { price: p } of known) {
    const key = p.store || 'Butik ikke valgt';
    const g = groups.get(key) || { sum: 0, count: 0 };
    groups.set(key, { sum: g.sum + p.total_ore!, count: g.count + 1 });
  }
  function choose(id: string) {
    setSelected(id);
    const p = byId.get(id);
    setStore(p?.store ?? '');
    setPrice(p?.total_ore != null ? String(p.total_ore / 100).replace('.', ',') : '');
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const item = items.find((i) => i.id === selected);
      if (!item) throw new Error('Vælg en vare.');
      const total = parseOre(price);
      if (total != null && total < 0) throw new Error('Prisen skal være mindst 0 kr.');
      const row = {
        item_id: item.id,
        household_id: householdId,
        item_signature: itemSignature(item),
        store: store.trim(),
        total_ore: total,
        updated_at: new Date().toISOString(),
      };
      const { error } = await commerceDb().from('vk_shopping_prices').upsert(row);
      if (error) throw new Error('Prisen kunne ikke gemmes.');
      setPrices((p) => [...p.filter((x) => x.item_id !== item.id), row]);
      setSelected('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke gemme.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mb-6 space-y-4 bg-sand/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Pris på det, du mangler</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {known.length} af {open.length} varer har en pris. {open.length - known.length} mangler
            pris.
          </p>
        </div>
        <strong className="font-display text-2xl text-brand-dark">
          {money(known.reduce((sum, x) => sum + x.price.total_ore!, 0))}
        </strong>
      </div>
      <p className="text-sm text-ink-muted">
        Summen gælder kun kendte priser på hele linjens mængde. Ret prisen efter ændring af vare
        eller mængde. Kvitteringspriser findes i historikken.
      </p>
      {groups.size > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...groups].map(([store, g]) => (
            <li key={store} className="rounded-xl border border-line bg-paper p-3">
              <strong>{store}</strong>
              <p className="text-sm">
                {g.count} varer · {money(g.sum)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-brand-dark">
        <Link href="/shopping/offers">Find tilbud →</Link>
        <Link href="/shopping/import">Importér kvittering →</Link>
        <Link href="/shopping/receipts">Se købshistorik →</Link>
      </div>
      {canEdit ? (
        <details>
          <summary className="cursor-pointer font-semibold">
            Tilføj eller ret en pris og butik
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Vare" htmlFor="price-item">
              <Select id="price-item" value={selected} onChange={(e) => choose(e.target.value)}>
                <option value="">Vælg vare</option>
                {open.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.quantity ?? ''} {i.unit ?? ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Butik" htmlFor="price-store">
              <Input
                id="price-store"
                value={store}
                maxLength={200}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Fx REMA 1000"
              />
            </Field>
            <Field label="Hele linjens pris (kr.)" htmlFor="price-total">
              <Input
                id="price-total"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="19,95"
              />
            </Field>
          </div>
          <Button className="mt-3" disabled={!selected || busy} onClick={() => void save()}>
            {busy ? 'Gemmer…' : 'Gem pris'}
          </Button>
        </details>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
    </Card>
  );
}

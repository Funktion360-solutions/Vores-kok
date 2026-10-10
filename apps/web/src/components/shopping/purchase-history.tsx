'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { SavedDocument } from '@/lib/commerce-client';
import { money } from '../../../../../packages/validation/src/commerce';
import { Alert, Badge, Card, Input, PageHeader } from '../ui';
export function PurchaseHistory({
  documents,
  truncated,
}: {
  documents: SavedDocument[];
  truncated: boolean;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('da');
  const shown = documents.filter(
    (d) =>
      !q ||
      (d.payload.store ?? '').toLocaleLowerCase('da').includes(q) ||
      d.payload.lines.some((l) => l.name.toLocaleLowerCase('da').includes(q)),
  );
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Købshistorik"
        subtitle="Faktiske, godkendte kvitteringspriser. Beløbene gælder hele linjens mængde og kan indeholde rabatter."
        eyebrow={<Link href="/shopping">← Indkøb</Link>}
        actions={
          <Link className="font-semibold text-brand-dark" href="/shopping/import">
            Importér kvittering →
          </Link>
        }
      />
      <Input
        aria-label="Søg i købshistorik"
        placeholder="Søg efter vare eller butik"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {truncated ? (
        <Alert tone="info">Viser de seneste 200 kvitteringer. Søgningen gælder disse.</Alert>
      ) : null}
      {!shown.length ? (
        <Card className="p-6">
          <p>
            {documents.length
              ? 'Ingen kvitteringer matcher.'
              : 'Her vises dine godkendte kvitteringer, når du har importeret den første.'}
          </p>
        </Card>
      ) : null}
      {shown.map((d) => (
        <Card key={d.id} className="p-5">
          <details open={!!q}>
            <summary className="cursor-pointer">
              <div className="inline-flex flex-wrap items-center gap-3">
                <strong className="font-display text-xl">
                  {d.payload.store ?? 'Ukendt butik'}
                </strong>
                <span className="text-sm text-ink-muted">{d.payload.date ?? 'Dato ukendt'}</span>
                {d.payload.total_ore != null ? (
                  <Badge tone="sage">{money(d.payload.total_ore)}</Badge>
                ) : null}
                <span className="text-sm">{d.payload.lines.length} linjer</span>
              </div>
            </summary>
            <ul className="mt-4 divide-y divide-line">
              {d.payload.lines.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <strong>{l.name}</strong>
                    <p className="text-sm text-ink-muted">
                      {l.quantity ?? 'Mængde ukendt'} {l.unit ?? ''} ·{' '}
                      {
                        { product: 'Vare', deposit: 'Pant', discount: 'Rabat', other: 'Øvrigt' }[
                          l.kind
                        ]
                      }
                      {l.pantry_location_id ? ' · Tilføjet til Mit køkken' : ''}
                    </p>
                    {l.warnings.length ? (
                      <p className="text-xs text-ink-muted">{l.warnings.join(' ')}</p>
                    ) : null}
                  </div>
                  <span className="font-semibold tabular-nums">
                    {l.price_ore == null ? 'Pris ukendt' : money(l.price_ore)}
                  </span>
                </li>
              ))}
            </ul>
            {d.payload.warnings.length ? (
              <p className="mt-3 text-sm text-ink-muted">{d.payload.warnings.join(' ')}</p>
            ) : null}
          </details>
        </Card>
      ))}
    </div>
  );
}

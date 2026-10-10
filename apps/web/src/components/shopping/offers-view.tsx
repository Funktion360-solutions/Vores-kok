'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { upsertShoppingItems, type ShoppingItem } from '@vores-kok/database';
import {
  copenhagenDay,
  money,
  offerCacheSchema,
  offerStatus,
  type OfferCache,
  type ProviderOffer,
} from '../../../../../packages/validation/src/commerce';
import { commerceDb, itemSignature, type SavedDocument } from '@/lib/commerce-client';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Badge, Button, Card, Input, PageHeader, Select } from '../ui';
const CHAIN_LABELS: Record<string, string> = {
  netto: 'Netto',
  fotex: 'Føtex',
  bilka: 'Bilka',
  rema1000: 'REMA 1000',
  '365discount': '365discount',
  brugsen: 'Brugsen',
  kvickly: 'Kvickly',
  superbrugsen: 'SuperBrugsen',
};
const external = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
};
export function OffersView({
  householdId,
  documents,
  lists,
  canEdit,
  initialWarning,
}: {
  householdId: string;
  documents: SavedDocument[];
  lists: { id: string; name: string }[];
  canEdit: boolean;
  initialWarning: string;
}) {
  const [cache, setCache] = useState<OfferCache | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [chain, setChain] = useState(''),
    [listId, setListId] = useState(lists[0]?.id ?? ''),
    [today, setToday] = useState(copenhagenDay()),
    [pending, setPending] = useState(''),
    [added, setAdded] = useState<Record<string, boolean>>({});
  const ids = useRef(new Map<string, string>());
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 110000);
    let alive = true;
    async function load() {
      try {
        const { data, error } = await getBrowserClient().functions.invoke('offers-sync', {
          body: { householdId },
          signal: controller.signal,
        });
        if (error) {
          if ('context' in error && error.context instanceof Response) {
            const body = await error.context.json().catch(() => null);
            throw new Error(body?.error ?? 'API-tilbud kunne ikke hentes.');
          }
          throw new Error('API-tilbud kunne ikke hentes. Kontrollér offers-sync og forbindelsen.');
        }
        const parsed = offerCacheSchema.parse(data);
        if (alive) setCache(parsed);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Tilbud kunne ikke hentes.');
      } finally {
        clearTimeout(timer);
        if (alive) setLoading(false);
      }
    }
    void load();
    const clock = setInterval(() => setToday(copenhagenDay()), 60000);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [householdId]);
  const q = query.trim().toLocaleLowerCase('da');
  const apiOffers = (cache?.offers ?? []).filter(
    (o) =>
      offerStatus(o.offer_starts, o.offer_ends, today) === 'active' &&
      (!chain || o.chain_slug === chain) &&
      (!q || ((o.brand ?? '') + ' ' + (o.name ?? '')).toLocaleLowerCase('da').includes(q)),
  );
  const manual = documents
    .flatMap((d) =>
      d.payload.lines
        .filter(
          (l) => l.kind === 'product' && offerStatus(l.valid_from, l.valid_to, today) !== 'expired',
        )
        .map((l) => ({ document: d, line: l })),
    )
    .filter(
      ({ document: d, line: l }) =>
        (!chain ||
          (d.payload.store ?? '')
            .toLocaleLowerCase('da')
            .includes((CHAIN_LABELS[chain] ?? chain).toLocaleLowerCase('da'))) &&
        (!q || l.name.toLocaleLowerCase('da').includes(q)),
    );
  async function add(key: string, name: string, store: string, price: number | null, note: string) {
    const requestKey = key + ':' + listId;
    setPending(requestKey);
    setError('');
    try {
      let id = ids.current.get(requestKey);
      if (!id) {
        id = crypto.randomUUID();
        ids.current.set(requestKey, id);
      }
      await upsertShoppingItems(getBrowserClient(), listId, [
        {
          id,
          name,
          quantity: 1,
          unit: 'pakke',
          unit_code: null,
          category: 'other',
          note,
          source_recipe_ids: [],
        },
      ]);
      const { data: item, error: itemError } = await getBrowserClient()
        .from('shopping_list_items')
        .select('*')
        .eq('id', id)
        .single();
      if (itemError || !item) throw new Error('Varen kunne ikke bekræftes. Prøv igen.');
      if (price !== null) {
        const { error } = await commerceDb()
          .from('vk_shopping_prices')
          .upsert({
            item_id: id,
            household_id: householdId,
            item_signature: itemSignature(item as ShoppingItem),
            store,
            total_ore: price,
            updated_at: new Date().toISOString(),
          })
          .select('item_id')
          .single();
        if (error) throw new Error('Varen er tilføjet, men prisen mangler. Prøv samme knap igen.');
      }
      setAdded((current) => ({ ...current, [requestKey]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke tilføje.');
    } finally {
      setPending('');
    }
  }
  function comparisons(offer: ProviderOffer) {
    if (offer.chain_gtins_source !== 'chain' || !offer.quantity_label || offer.multi_buy) return [];
    return (cache?.offers ?? [])
      .filter(
        (o) =>
          o.chain_slug !== offer.chain_slug &&
          o.chain_gtins_source === 'chain' &&
          !o.multi_buy &&
          o.quantity_label === offer.quantity_label &&
          offerStatus(o.offer_starts, o.offer_ends, today) === 'active' &&
          o.chain_gtins.some((g) => offer.chain_gtins.includes(g)),
      )
      .sort((a, b) => a.price - b.price);
  }
  function addButton(key: string, name: string, store: string, price: number | null, note: string) {
    const requestKey = key + ':' + listId;
    return canEdit ? (
      <Button
        size="sm"
        variant="secondary"
        disabled={!listId || !!pending || added[requestKey]}
        onClick={() => void add(key, name, store, price, note)}
      >
        {added[requestKey]
          ? 'Tilføjet ✓'
          : pending === requestKey
            ? 'Tilføjer…'
            : 'Tilføj 1 pakke til listen'}
      </Button>
    ) : null;
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Tilbud og tilbudsaviser"
        subtitle="Salling Group, REMA 1000 og Coop. Søg i det hentede udvalg og dine godkendte tilbud."
        eyebrow={<Link href="/shopping">← Indkøb</Link>}
        actions={
          canEdit ? (
            <Link href="/shopping/import" className="font-semibold text-brand-dark">
              Importér tilbudsavis →
            </Link>
          ) : null
        }
      />
      <Card className="space-y-3 bg-sand/50 p-5">
        <h2 className="font-semibold">Dit område: 9000 Aalborg + 45 km</h2>
        <p className="text-sm text-ink-muted">
          API-data er kædepriser. De er endnu ikke bekræftet i hver lokal butik inden for 45 km.
          Kontrollér pakningsstørrelse, medlemskrav og lager hos butikken.
        </p>
        <p className="text-sm text-ink-muted">
          API-udvalget gemmes fælles frem til næste onsdag. Første besøg fra onsdag henter nyt;
          udløbne tilbud skjules dagligt. Højst 9 API-kald pr. ugentlig hentning.
        </p>
        {cache ? (
          <p className="text-xs text-ink-muted">
            Hentet {new Date(cache.fetched_at).toLocaleString('da-DK')} · Kildens data:{' '}
            {cache.as_of ?? 'ukendt dato'} · Kilde:{' '}
            <a
              href="https://prej.dk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Prej
            </a>
          </p>
        ) : null}
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          aria-label="Søg tilbud"
          placeholder="Søg efter fx mælk eller mel"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select aria-label="Kæde" value={chain} onChange={(e) => setChain(e.target.value)}>
          <option value="">Alle kæder</option>
          {Object.entries(CHAIN_LABELS).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        {canEdit ? (
          <Select
            aria-label="Indkøbsliste til tilbud"
            value={listId}
            onChange={(e) => setListId(e.target.value)}
          >
            <option value="">Vælg indkøbsliste</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      {loading ? (
        <p role="status" className="text-ink-muted">
          Henter fælles tilbudsoversigt…
        </p>
      ) : null}
      {error ? <Alert tone="info">{error}</Alert> : null}
      {initialWarning ? <Alert tone="info">{initialWarning}</Alert> : null}
      {cache?.warnings.length ? (
        <Alert tone="info">{[...new Set(cache.warnings)].join(' ')}</Alert>
      ) : null}
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">
          Tilbud i udvalget ({apiOffers.length})
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {apiOffers.map((o) => {
            const key = o.chain_slug + ':' + o.product_id;
            const name = [o.brand, o.name, o.quantity_label].filter(Boolean).join(' ');
            const matches = comparisons(o);
            return (
              <Card key={key} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="brand">{o.chain_name}</Badge>
                    <h3 className="mt-2 font-semibold">{name || 'Vare uden navn'}</h3>
                  </div>
                  <strong className="whitespace-nowrap font-display text-xl">
                    {money(o.price)}
                  </strong>
                </div>
                <p className="text-sm text-ink-muted">
                  Til og med {o.offer_ends}
                  {o.normal_price != null ? ' · Oplyst normalpris ' + money(o.normal_price) : ''}
                </p>
                {o.multi_buy ? (
                  <p className="text-sm">
                    Flere styk: {o.multi_buy.quantity} for {money(o.multi_buy.price)}. Knappen
                    tilføjer én pakke til enkeltprisen ovenfor.
                  </p>
                ) : null}
                {matches.length ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-brand-dark">
                      Samme stregkode og størrelse i {matches.length} andre kæder
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {matches.map((m) => (
                        <li key={m.chain_slug + ':' + m.product_id}>
                          {m.chain_name}: {money(m.price)} · til {m.offer_ends}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-ink-muted">
                      Kun dette udvalg. Kontrollér medlemskrav og øvrige betingelser hos kæden.
                    </p>
                  </details>
                ) : null}
                {o.name
                  ? addButton(
                      key,
                      name,
                      o.chain_name,
                      o.price,
                      'Tilbud til ' + o.offer_ends + '. Kontrollér betingelser hos butikken.',
                    )
                  : null}
              </Card>
            );
          })}
        </div>
        {!loading && !apiOffers.length ? (
          <p className="text-sm text-ink-muted">
            Ingen API-tilbud matcher. Importerede tilbud og aviser vises nedenfor.
          </p>
        ) : null}
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">
          Dine importerede tilbud ({manual.length})
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {manual.map(({ document: d, line: l }) => {
            const status = offerStatus(l.valid_from, l.valid_to, today);
            return (
              <Card key={d.id + ':' + l.id} className="space-y-3 p-5">
                <Badge>{d.payload.store ?? 'Ukendt butik'} · Importeret</Badge>
                <h3 className="font-semibold">{l.name}</h3>
                <strong className="font-display text-xl">
                  {l.price_ore == null ? 'Pris ukendt' : money(l.price_ore)}
                </strong>
                <p className="text-sm text-ink-muted">
                  {status === 'future'
                    ? 'Kommende: fra ' + l.valid_from
                    : status === 'unknown'
                      ? 'Gyldighed ukendt – kontrollér avisen'
                      : 'Gyldig nu'}
                  {l.valid_to ? ' · til ' + l.valid_to : ''}
                </p>
                {l.membership ? <Badge tone="honey">Kræver medlemskab</Badge> : null}
                <p className="text-sm">
                  {l.quantity ?? ''} {l.unit ?? ''}
                  {l.warnings.length ? ' · ' + l.warnings.join(' ') : ''}
                </p>
                {status === 'active'
                  ? addButton(
                      l.id,
                      l.name,
                      d.payload.store ?? '',
                      l.price_ore,
                      'Importeret tilbud til ' +
                        l.valid_to +
                        (l.membership ? '. Medlemspris.' : '.'),
                    )
                  : null}
              </Card>
            );
          })}
        </div>
        {!manual.length ? (
          <p className="text-sm text-ink-muted">
            Importér en tilbudsavis som PDF, billede eller tekst for at tilføje lokale tilbud.
          </p>
        ) : null}
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">Tilbudsaviser fra kæderne</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(cache?.flyers ?? [])
            .filter((f) => f.valid_to >= today && (!chain || f.chain_slug === chain))
            .map((f) => (
              <Card key={f.flyer_id} className="space-y-3 p-5">
                <h3 className="font-semibold">{f.chain_name}</h3>
                <p className="text-sm text-ink-muted">
                  {f.valid_from} – {f.valid_to}
                  {f.valid_from > today ? ' · Kommende avis' : ''}
                </p>
                <div className="flex flex-wrap gap-3">
                  {f.page_urls.map((url, index) => {
                    const href = external(url);
                    return href ? (
                      <a
                        key={url}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-brand-dark"
                      >
                        Side {index + 1} ↗
                      </a>
                    ) : null;
                  })}
                </div>
              </Card>
            ))}
        </div>
      </section>
    </div>
  );
}

'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { PantryLocation } from '@vores-kok/database';
import {
  commerceDocumentSchema,
  money,
  parseOre,
  type CommerceDocument,
} from '../../../../../packages/validation/src/commerce';
import { approvedDocumentSchema, commerceDb, type ApprovedDocument } from '@/lib/commerce-client';
import { getBrowserClient } from '@/lib/supabase/client';
import { prepareUpload } from '@/lib/image';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '../ui';
type ReviewLine = ApprovedDocument['lines'][number] & {
  included: boolean;
  priceText: string;
  quantityText: string;
};
const subscribeStorage = () => () => {};
type Pending = { id: string; kind: 'receipt' | 'flyer'; payload: ApprovedDocument };
export function CommerceImport({
  householdId,
  userId,
  locations,
}: {
  householdId: string;
  userId: string;
  locations: PantryLocation[];
}) {
  const [kind, setKind] = useState<'receipt' | 'flyer'>('receipt'),
    [mode, setMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(''),
    [document, setDocument] = useState<CommerceDocument | null>(null);
  const [lines, setLines] = useState<ReviewLine[]>([]),
    [totalText, setTotalText] = useState(''),
    [currency, setCurrency] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [attemptPending, setPending] = useState<Pending | null>(null),
    [saved, setSaved] = useState(false);
  const recoveryKey = 'vk-commerce-pending:' + userId + ':' + householdId;
  const recoveredRaw = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return sessionStorage.getItem(recoveryKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const recovered = useMemo(() => {
    try {
      if (!recoveredRaw) return null;
      const p = JSON.parse(recoveredRaw);
      const parsed = approvedDocumentSchema.safeParse(p.payload);
      return parsed.success && ['receipt', 'flyer'].includes(p.kind) && /^[a-f0-9-]{36}$/.test(p.id)
        ? ({ ...p, payload: parsed.data } as Pending)
        : null;
    } catch {
      return null;
    }
  }, [recoveredRaw]);
  const pending = attemptPending ?? recovered;

  async function extract() {
    setBusy(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const form = new FormData();
      form.set('householdId', householdId);
      form.set('kind', kind);
      if (mode === 'text') {
        if (!text.trim() || text.length > 60000) throw new Error('Indsæt 1–60.000 tegn.');
        form.set('text', text);
      } else {
        if (!file) throw new Error('Vælg en fil.');
        if (file.size > 5 * 1024 * 1024)
          throw new Error('Maks. 5 MB. Del større tilbudsaviser op i færre sider.');
        if (file.type === 'text/plain') {
          const value = await file.text();
          if (value.length > 60000) throw new Error('Teksten er for lang.');
          form.set('text', value);
        } else {
          const prepared = await prepareUpload(file);
          if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(prepared.mime))
            throw new Error('Brug PDF, JPG, PNG eller WebP.');
          form.set(
            'file',
            new File(
              [prepared.blob],
              'import' + (prepared.mime === 'application/pdf' ? '.pdf' : '.jpg'),
              { type: prepared.mime },
            ),
          );
        }
      }
      const { data, error: fnError } = await getBrowserClient().functions.invoke(
        'shopping-import',
        { body: form, signal: controller.signal },
      );
      if (fnError) {
        if ('context' in fnError && fnError.context instanceof Response) {
          const body = await fnError.context.json().catch(() => null);
          throw new Error(body?.error ?? 'Importen fejlede.');
        }
        throw new Error('Importen kunne ikke hentes. Kontrollér forbindelse og shopping-import.');
      }
      const doc = commerceDocumentSchema.parse(data);
      setDocument(doc);
      setCurrency(doc.currency ?? '');
      setTotalText(doc.total_ore == null ? '' : String(doc.total_ore / 100).replace('.', ','));
      setLines(
        doc.lines.map((l) => ({
          ...l,
          id: crypto.randomUUID(),
          pantry_location_id: null,
          included: true,
          priceText: l.price_ore == null ? '' : String(l.price_ore / 100).replace('.', ','),
          quantityText: l.quantity == null ? '' : String(l.quantity),
        })),
      );
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'Aflæsningen tog for lang tid. Prøv et tydeligere billede eller færre sider.'
          : e instanceof Error
            ? e.message
            : 'Importen fejlede.',
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }
  function patch(id: string, value: Partial<ReviewLine>) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, ...value } : l)));
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      let attempt = pending;
      if (!attempt) {
        if (!document) throw new Error('Aflæs dokumentet først.');
        if (currency !== 'DKK')
          throw new Error('Bekræft danske kroner. Andre valutaer understøttes ikke endnu.');
        const approved = lines
          .filter((l) => l.included)
          .map((l) => {
            const { included: _, priceText, quantityText, ...line } = l;
            void _;
            const q = quantityText.trim() ? Number(quantityText.replace(',', '.')) : null;
            if (q !== null && (!Number.isFinite(q) || q <= 0))
              throw new Error('Mængder skal være positive tal.');
            const price = parseOre(priceText);
            if (price != null && price < 0 && line.kind !== 'discount')
              throw new Error('Kun rabatlinjer må have negativ pris.');
            for (const d of [line.valid_from, line.valid_to]) {
              if (d && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) !== d)
                throw new Error('Kontrollér tilbudsdatoerne.');
            }
            if (line.valid_from && line.valid_to && line.valid_from > line.valid_to)
              throw new Error('Slutdato skal være efter startdato.');
            return {
              ...line,
              price_ore: price,
              quantity: q,
              pantry_location_id:
                kind === 'receipt' && line.kind === 'product' ? line.pantry_location_id : null,
            };
          });
        const payload = approvedDocumentSchema.parse({
          ...document,
          currency,
          total_ore: parseOre(totalText),
          lines: approved,
          warnings: [
            ...document.warnings,
            ...(approved.length < lines.length
              ? [
                  'Delvis import: ' +
                    approved.length +
                    ' af ' +
                    lines.length +
                    ' linjer blev godkendt. Kvitteringens total kan indeholde udeladte linjer.',
                ]
              : []),
          ].slice(0, 20),
        });
        attempt = { id: crypto.randomUUID(), kind, payload };
        // Save the exact approved request before sending: retry cannot duplicate pantry items.
        try {
          sessionStorage.setItem(recoveryKey, JSON.stringify(attempt));
        } catch {
          throw new Error(
            'Browseren kan ikke bevare godkendelsen. Tillad sessionslager og prøv igen. Der er endnu ikke gemt noget.',
          );
        }
        setPending(attempt);
      }
      const { data, error } = await commerceDb()
        .rpc('vk_save_commerce', {
          p_id: attempt.id,
          p_household_id: householdId,
          p_kind: attempt.kind,
          p_payload: attempt.payload,
        })
        .abortSignal(AbortSignal.timeout(30000));
      if (error || data !== attempt.id)
        throw new Error(
          'Kunne ikke bekræfte gemningen. Tryk “Prøv samme godkendelse igen”; den giver ikke dubletter.',
        );
      try {
        sessionStorage.removeItem(recoveryKey);
      } catch {
        /* Saved in database. */
      }
      setKind(attempt.kind);
      setSaved(true);
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke gemme.');
    } finally {
      setBusy(false);
    }
  }
  let sum: number | null = 0;
  for (const l of lines.filter((l) => l.included)) {
    try {
      const price = parseOre(l.priceText);
      if (price == null) {
        sum = null;
        break;
      }
      sum += price;
    } catch {
      sum = null;
      break;
    }
  }
  let total: number | null = null;
  try {
    total = parseOre(totalText);
  } catch {
    /* Shown as invalid on approval. */
  }
  const included = lines.filter((l) => l.included).length;
  if (saved)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Godkendelsen er gemt"
          subtitle="Priserne ligger i historikken. Valgte råvarer er tilføjet til Mit køkken."
        />
        <div className="flex flex-wrap gap-4">
          <Link
            href={kind === 'receipt' ? '/shopping/receipts' : '/shopping/offers'}
            className="font-semibold text-brand-dark"
          >
            Se {kind === 'receipt' ? 'købshistorik' : 'tilbud'} →
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(false);
              setDocument(null);
              setLines([]);
              setError('');
              setFile(null);
              setText('');
            }}
          >
            Importér et nyt dokument
          </Button>
          <Link href="/kitchen">Mit køkken →</Link>
          <Link href="/shopping">Indkøb →</Link>
        </div>
      </div>
    );
  if (pending)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader
          title="Bekræft godkendelsen"
          subtitle="Din godkendte import er bevaret i denne browsersession. Samme godkendelse kan sendes igen uden dubletter."
        />
        <Card className="p-5">
          <h2 className="font-semibold">
            {pending.payload.store || 'Ukendt butik'} · {pending.payload.lines.length} linjer
          </h2>
          <Button className="mt-4" disabled={busy} onClick={() => void save()}>
            {busy ? 'Gemmer…' : 'Prøv samme godkendelse igen'}
          </Button>
        </Card>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Importér til indkøb"
        subtitle="Aflæs en kvittering eller tilbudsavis. Ret linjerne og godkend dem samlet."
        eyebrow={<Link href="/shopping">← Indkøb</Link>}
      />
      {!document ? (
        <Card className="space-y-4 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dokument" htmlFor="commerce-kind">
              <Select
                id="commerce-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                disabled={busy}
              >
                <option value="receipt">Kvittering</option>
                <option value="flyer">Tilbudsavis</option>
              </Select>
            </Field>
            <Field label="Kilde" htmlFor="commerce-mode">
              <Select
                id="commerce-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                disabled={busy}
              >
                <option value="file">PDF eller billede</option>
                <option value="text">Indsæt tekst</option>
              </Select>
            </Field>
          </div>
          {mode === 'file' ? (
            <Field label="Fil (maks. 5 MB)" htmlFor="commerce-file">
              <Input
                id="commerce-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
          ) : (
            <Field label="Dokumentets tekst" htmlFor="commerce-text">
              <Textarea
                id="commerce-text"
                rows={10}
                maxLength={60000}
                disabled={busy}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
          )}
          <p className="text-sm text-ink-muted">
            Filen eller teksten sendes til AI-udbyderen. Kontrollér aflæsningen. Originalfilen
            gemmes ikke; kun dine godkendte linjer gemmes.
          </p>
          <Button disabled={busy} onClick={() => void extract()}>
            {busy ? 'Aflæser dokument…' : 'Aflæs dokument'}
          </Button>
          {busy ? (
            <p role="status" className="text-sm text-ink-muted">
              Det kan tage op til 2 minutter. Store PDF’er bør deles op.
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Butik" htmlFor="receipt-store">
                <Input
                  id="receipt-store"
                  value={document.store ?? ''}
                  maxLength={200}
                  onChange={(e) => setDocument({ ...document, store: e.target.value || null })}
                />
              </Field>
              <Field label="Valuta" htmlFor="receipt-currency">
                <Select
                  id="receipt-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="">Bekræft valuta</option>
                  <option value="DKK">Danske kroner (DKK)</option>
                  {currency && currency !== 'DKK' ? (
                    <option value={currency}>{currency} (ikke understøttet)</option>
                  ) : null}
                </Select>
              </Field>
              {kind === 'receipt' ? (
                <>
                  <Field label="Kvitteringsdato" htmlFor="receipt-date">
                    <Input
                      id="receipt-date"
                      type="date"
                      value={document.date ?? ''}
                      onChange={(e) => setDocument({ ...document, date: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Kvitteringens total (kr.)" htmlFor="receipt-total">
                    <Input
                      id="receipt-total"
                      inputMode="decimal"
                      value={totalText}
                      onChange={(e) => setTotalText(e.target.value)}
                    />
                  </Field>
                </>
              ) : null}
            </div>
            {document.warnings.length ? (
              <Alert tone="info">{document.warnings.join(' ')}</Alert>
            ) : null}
            <p className="text-sm">
              {included} valgte linjer ·{' '}
              {sum == null ? 'Nogle linjer mangler pris.' : 'Linjesum: ' + money(sum)}
            </p>
            {kind === 'receipt' && sum != null && total != null && sum !== total ? (
              <Alert tone="info">
                Linjesummen afviger fra totalen med {money(Math.abs(sum - total))}. Kontrollér
                rabatter, pant og udeladte linjer.
              </Alert>
            ) : null}
            {kind === 'receipt' ? (
              <Field
                label="Tilføj alle valgte varer til Mit køkken (valgfrit)"
                htmlFor="receipt-bulk-location"
              >
                <Select
                  id="receipt-bulk-location"
                  defaultValue=""
                  onChange={(e) => {
                    const location = e.target.value || null;
                    setLines((current) =>
                      current.map((l) =>
                        l.included && l.kind === 'product'
                          ? { ...l, pantry_location_id: location }
                          : l,
                      ),
                    );
                  }}
                >
                  <option value="">Kun købshistorik</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </Card>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <Card key={line.id} className={'p-5 ' + (!line.included ? 'opacity-60' : '')}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="size-5 accent-brand"
                      checked={line.included}
                      onChange={(e) => patch(line.id, { included: e.target.checked })}
                    />
                    Linje {index + 1}
                  </label>
                  <Badge>
                    {
                      { product: 'Vare', deposit: 'Pant', discount: 'Rabat', other: 'Øvrigt' }[
                        line.kind
                      ]
                    }
                  </Badge>
                  {line.membership ? <Badge tone="honey">Medlemspris</Badge> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Vare eller betingelser" htmlFor={'name-' + line.id}>
                    <Input
                      id={'name-' + line.id}
                      value={line.name}
                      maxLength={200}
                      onChange={(e) => patch(line.id, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Linjens samlede pris (kr.)" htmlFor={'amount-' + line.id}>
                    <Input
                      id={'amount-' + line.id}
                      inputMode="decimal"
                      value={line.priceText}
                      onChange={(e) => patch(line.id, { priceText: e.target.value })}
                    />
                  </Field>
                  <Field label="Mængde (lad være tom ved tvivl)" htmlFor={'qty-' + line.id}>
                    <Input
                      id={'qty-' + line.id}
                      inputMode="decimal"
                      value={line.quantityText}
                      onChange={(e) => patch(line.id, { quantityText: e.target.value })}
                    />
                  </Field>
                  <Field label="Enhed" htmlFor={'unit-' + line.id}>
                    <Input
                      id={'unit-' + line.id}
                      value={line.unit ?? ''}
                      maxLength={40}
                      onChange={(e) => patch(line.id, { unit: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Linjetype" htmlFor={'kind-' + line.id}>
                    <Select
                      id={'kind-' + line.id}
                      value={line.kind}
                      onChange={(e) =>
                        patch(line.id, {
                          kind: e.target.value as ReviewLine['kind'],
                          pantry_location_id: null,
                        })
                      }
                    >
                      <option value="product">Vare</option>
                      <option value="deposit">Pant</option>
                      <option value="discount">Rabat</option>
                      <option value="other">Øvrigt</option>
                    </Select>
                  </Field>
                  {kind === 'receipt' && line.kind === 'product' ? (
                    <Field label="Mit køkken" htmlFor={'location-' + line.id}>
                      <Select
                        id={'location-' + line.id}
                        value={line.pantry_location_id ?? ''}
                        onChange={(e) =>
                          patch(line.id, { pantry_location_id: e.target.value || null })
                        }
                      >
                        <option value="">Tilføj ikke</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  {kind === 'flyer' ? (
                    <>
                      <Field label="Gyldig fra" htmlFor={'from-' + line.id}>
                        <Input
                          id={'from-' + line.id}
                          type="date"
                          value={line.valid_from ?? ''}
                          onChange={(e) => patch(line.id, { valid_from: e.target.value || null })}
                        />
                      </Field>
                      <Field label="Gyldig til" htmlFor={'to-' + line.id}>
                        <Input
                          id={'to-' + line.id}
                          type="date"
                          value={line.valid_to ?? ''}
                          onChange={(e) => patch(line.id, { valid_to: e.target.value || null })}
                        />
                      </Field>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={line.membership}
                          onChange={(e) => patch(line.id, { membership: e.target.checked })}
                        />
                        Kræver medlemskab
                      </label>
                    </>
                  ) : null}
                </div>
                {line.warnings.length ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    Kontrollér: {line.warnings.join(' ')}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
          <div className="sticky bottom-3 rounded-2xl border border-line bg-paper p-4 shadow-lg">
            <Button disabled={busy || included === 0} onClick={() => void save()}>
              {busy ? 'Gemmer…' : 'Godkend og gem ' + included + ' linjer'}
            </Button>
            <p className="mt-2 text-xs text-ink-muted">
              Pant og rabatter gemmes særskilt. Kun valgte varer med opbevaringssted tilføjes til
              Mit køkken.
            </p>
          </div>
        </>
      )}
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

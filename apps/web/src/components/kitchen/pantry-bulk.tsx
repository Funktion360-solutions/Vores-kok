'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseIngredientLine, formatQuantity } from '@vores-kok/domain';
import { pantryItemSchema } from '@vores-kok/validation';
import type { PantryLocation } from '@vores-kok/database';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Field, Select, Spinner, Textarea } from '../ui';
type Row = { id: string; name: string; quantity: number | null; unit: string | null; unit_code: string | null; notes: string | null };
export function PantryBulk({ householdId, locations, onDone }: { householdId: string; locations: PantryLocation[]; onDone: () => void }) {
  const router = useRouter();
  const [text, setText] = useState(''); const [location, setLocation] = useState(locations[0]?.id ?? '');
  const [rows, setRows] = useState<Row[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  function preview() {
    setError('');
    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length || lines.length > 50) throw new Error('Skriv 1–50 varer, én pr. linje.');
      const parsed = lines.map(line => { const p = parseIngredientLine(line); if (/:$/.test(line) && !/\d/.test(line)) throw new Error('Skriv kun varer; overskrifter med kolon skal fjernes.');
        if (p.quantityMax !== null && p.quantityMax !== undefined) throw new Error('Brug én mængde pr. vare, fx “2 æbler”, i stedet for et interval.');
        const validation = pantryItemSchema.safeParse({ household_id: householdId, location_id: location, name: p.name, quantity: p.quantity, unit: p.unit, unit_code: p.unitCode });
        if (!validation.success) throw new Error(`Kontrollér “${line}”: ${validation.error.issues[0]?.message ?? 'Ugyldig vare'}`);
        const validated = validation.data;
        return { id: crypto.randomUUID(), name: validated.name, quantity: validated.quantity ?? null, unit: validated.unit ?? null, unit_code: validated.unit_code ?? null, notes: p.preparation || p.approximate || p.isOptional ? `Oprindelig indtastning: ${line}` : null };
      });
      setRows(parsed);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kontrollér varerne.'); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const db = getBrowserClient();
      const { data: previous, error: queryError } = await db.from('pantry_items').select('id').eq('household_id', householdId).in('id', rows.map(r => r.id)).abortSignal(AbortSignal.timeout(15000));
      if (queryError) throw queryError;
      const ids = new Set(previous.map(r => r.id));
      const pending = rows.filter(r => !ids.has(r.id));
      if (pending.length) {
        const { error: saveError } = await db.from('pantry_items').insert(pending.map(r => ({ ...r, household_id: householdId, location_id: location }))).abortSignal(AbortSignal.timeout(30000));
        if (saveError) throw saveError;
      }
      router.refresh(); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Varerne kunne ikke gemmes. Prøv igen.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4"><p className="text-sm text-ink-soft">Skriv hele indkøbet ind på én gang. Alle varer placeres samme sted; du kan flytte dem og tilføje datoer bagefter. Eksisterende varer lægges ikke sammen automatisk.</p><Field label="Opbevaringssted" htmlFor="bulk-location"><Select id="bulk-location" value={location} disabled={busy || !!rows.length} onChange={e => setLocation(e.target.value)}>{locations.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</Select></Field>{rows.length ? <><div className="rounded-xl border border-line bg-cream p-4"><h3 className="font-semibold">Kontrollér de {rows.length} varer</h3><ul className="mt-3 space-y-2">{rows.map(r => <li key={r.id}>{r.quantity !== null ? `${formatQuantity(r.quantity)} ${r.unit ?? ''} ` : ''}{r.name}</li>)}</ul></div><p className="text-xs text-ink-muted">Mængder uden enhed gemmes som skrevet. Der sættes ingen bedst-før-dato automatisk.</p><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void save()}>{busy ? <><Spinner /> Gemmer…</> : 'Godkend og tilføj varer'}</Button><Button variant="ghost" disabled={busy} onClick={() => { setRows([]); setError(''); }}>Ret indtastning</Button></div></> : <><Field label="Varer — én pr. linje" htmlFor="bulk-items" hint="Op til 50 varer. Fx 500 g hakket oksekød, 2 æbler og 1 l havredrik."><Textarea id="bulk-items" value={text} onChange={e => setText(e.target.value)} maxLength={15000} rows={10} placeholder={'500 g hakket oksekød\n2 æbler\n1 l havredrik'} /></Field><Button disabled={!text.trim() || !location} onClick={preview}>Gennemgå varer</Button></>}{error ? <Alert>{error}</Alert> : null}</div>;
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, Field, Input, Spinner, Textarea } from '../ui';
import { addMediaRow, type Category, type Person } from '@vores-kok/database';
import { buildMediaPath, MEDIA_BUCKET } from '@vores-kok/domain';
import { importResultSchema, type ImportedRecipe } from '../../../../../packages/validation/src/import';
import { importToDraft } from '@/lib/import-draft';
import { getBrowserClient } from '@/lib/supabase/client';
import { prepareUpload } from '@/lib/image';
import { RecipeEditor } from './recipe-editor';

export function RecipeImport({ householdId, categories, people }: { householdId: string; categories: Category[]; people: Person[] }) {
  const [kind, setKind] = useState<'text' | 'url' | 'file'>('file');
  const [text, setText] = useState(''); const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [recipes, setRecipes] = useState<ImportedRecipe[]>([]);
  const [source, setSource] = useState({ name: '', url: '', text: '', file: false });
  const [selected, setSelected] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [original, setOriginal] = useState<File | null>(null);
  const [pendingOriginal, setPendingOriginal] = useState<{ id: string; index: number } | null>(null);
  async function extract() {
    setBusy(true); setError('');
    try {
      const form = new FormData(); form.set('householdId', householdId);
      let inputText = text; let sourceUrl = ''; let name = 'Indsat tekst'; let sourceFile: File | null = null;
      if (kind === 'url') {
        const response = await fetch('/api/import-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Hjemmesiden kunne ikke hentes.');
        inputText = data.text; sourceUrl = data.url; name = sourceUrl;
        if (data.recipes) {
          setRecipes(importResultSchema.parse({ recipes: data.recipes }).recipes);
          setSource({ name, url: sourceUrl, text: inputText, file: false }); setOriginal(null); setSaved({}); return;
        }
        // URL fetching and AI extraction share the same atomic request quota.
        await new Promise(resolve => setTimeout(resolve, 5100));
      }
      if (kind === 'file') {
        if (!file) throw new Error('Vælg en fil.');
        if (file.size > 5 * 1024 * 1024) throw new Error('Maks. 5 MB pr. fil. Del større PDF’er op.');
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'text/plain'].includes(file.type)) throw new Error('Brug PDF, JPG, PNG, WebP, HEIC eller TXT.');
        if (file.type === 'text/plain') { inputText = await file.text(); name = file.name; }
        else {
          const prepared = await prepareUpload(file);
          if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(prepared.mime)) throw new Error('Konvertér HEIC til JPG, hvis browseren ikke kan læse billedet.');
          sourceFile = new File([prepared.blob], file.type === 'application/pdf' ? 'opskrift.pdf' : 'opskrift.jpg', { type: prepared.mime });
          form.set('file', sourceFile); name = file.name;
        }
      }
      if (!sourceFile) { if (!inputText.trim() || inputText.length > 60000) throw new Error('Indsæt 1–60.000 tegn.'); form.set('text', inputText); }
      const { data, error: fnError } = await getBrowserClient().functions.invoke('recipe-import', { body: form });
      if (fnError) {
        const context = 'context' in fnError ? fnError.context : null;
        if (context instanceof Response) { const body = await context.json().catch(() => null); throw new Error(body?.error ?? 'Importen fejlede.'); }
        throw new Error('Kontrollér forbindelsen og at recipe-import er deployet.');
      }
      setRecipes(importResultSchema.parse(data).recipes); setSaved({}); setOriginal(sourceFile);
      setSource({ name, url: sourceUrl, text: sourceFile ? '' : inputText, file: !!sourceFile });
    } catch (e) { setError(e instanceof Error ? e.message : 'Importen fejlede.'); }
    finally { setBusy(false); }
  }
  async function attachOriginal(id: string, index: number) {
    if (!original) return;
    const db = getBrowserClient();
    const mime = original.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
    const path = buildMediaPath(householdId, 'recipes', id, crypto.randomUUID(), mime);
    const { error: uploadError } = await db.storage.from(MEDIA_BUCKET).upload(path, original, { contentType: mime, upsert: false });
    if (uploadError) throw uploadError;
    await addMediaRow(db, { recipe_id: id, household_id: householdId, storage_path: path, mime_type: mime,
      kind: mime === 'application/pdf' ? 'document' : 'original_scan', caption: `Importkilde: ${source.name}`, byte_size: original.size });
    setPendingOriginal(null); setSaved(s => ({ ...s, [index]: id }));
  }
  async function afterSave(id: string) {
    setBusy(true);
    const index = selected!; setSaved(s => ({ ...s, [index]: id })); setSelected(null);
    try { await attachOriginal(id, index); }
    catch { setPendingOriginal({ id, index }); setError('Opskriften er gemt, men originalfilen kunne ikke vedhæftes. Prøv igen nedenfor; opskriften oprettes ikke igen.'); }
    finally { setBusy(false); }
  }
  if (selected !== null) {
    const recipe = recipes[selected]!;
    const draft = importToDraft(recipe, householdId, { ...source, text: source.text || recipe.original_text });
    return <div className="space-y-5"><Button variant="secondary" onClick={() => setSelected(null)}>Tilbage til udkast (ugemte ændringer mistes)</Button>
      <p>Kontrollér alle felter før gemning. Originalkilden bevares; AI kan have læst forkert.</p>
      {recipe.warnings.length ? <ul className="list-disc pl-5">{recipe.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
      <RecipeEditor key={selected} initial={draft} mode="create" categories={categories} people={people} onSaved={afterSave} />
    </div>;
  }
  return <div className="space-y-6">
    <Card className="p-5 sm:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">Fra original til din kogebog</h2><p className="mt-2 max-w-2xl text-ink-soft">Upload en opskrift eller indsæt et link. Vi samler ingredienser, fremgangsmåde og noter i et udkast, du selv godkender.</p></div><Badge tone="brand">Gemmes først efter din godkendelse</Badge></div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Vælg importtype">{([{ key: 'file', title: 'Billede eller PDF', detail: 'Foto, screenshot eller dokument' }, { key: 'url', title: 'Hjemmeside', detail: 'Indsæt linket til opskriften' }, { key: 'text', title: 'Tekst', detail: 'Kopiér opskriften direkte' }] as const).map(option => <button key={option.key} type="button" aria-pressed={kind === option.key} disabled={busy || !!pendingOriginal} onClick={() => setKind(option.key)} className={`min-h-24 rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${kind === option.key ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-paper text-ink hover:bg-sand'}`}><span className="block font-semibold">{option.title}</span><span className="mt-1 block text-sm">{option.detail}</span></button>)}</div>
      <div className="rounded-xl border border-line bg-cream p-4 sm:p-5">
        {kind === 'file' ? <div className="space-y-4"><Field label="Vælg din original" htmlFor="import-file" hint="PDF, JPG, PNG, WebP, HEIC eller TXT · højst 5 MB"><Input id="import-file" type="file" className="file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-brand-dark" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,text/plain" disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field><Field label="Eller tag et foto med kameraet" htmlFor="import-camera"><Input id="import-camera" type="file" accept="image/*" capture="environment" disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field>{file ? <p className="break-words text-sm text-ink-soft">Valgt: <strong>{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(1)} MB</p> : null}</div> : kind === 'url' ? <Field label="Link til opskriften" htmlFor="import-url" hint="Brug et direkte https-link til siden med opskriften."><Input id="import-url" type="url" value={url} disabled={busy} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></Field> : <Field label="Indsæt hele opskriften" htmlFor="import-text" hint={`${text.length.toLocaleString('da-DK')} / 60.000 tegn · medtag gerne tips og noter`}><Textarea id="import-text" rows={12} maxLength={60000} value={text} disabled={busy} onChange={e => setText(e.target.value)} placeholder="Titel, ingredienser, fremgangsmåde og gode råd…" /></Field>}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4"><Button size="lg" disabled={busy || !!pendingOriginal || (kind === 'file' ? !file : kind === 'url' ? !url.trim() : !text.trim())} onClick={() => void extract()}>{busy ? <><Spinner /> Læser opskriften…</> : 'Opret opskriftsudkast'}</Button><p className="text-sm text-ink-muted" role="status">{busy ? 'Store dokumenter kan tage op til halvandet minut.' : 'Op til 10 opskrifter pr. import'}</p></div>
      <p className="mt-5 text-xs leading-relaxed text-ink-muted">Kilden sendes til AI, når automatisk udtræk ikke er nok. Udkastene findes kun, mens siden er åben. Billeder vedhæftes som en læsbar kopi uden GPS/EXIF; PDF bevares uændret. Kontrollér altid resultatet.</p>
    </Card>
    {error ? <Alert>{error}</Alert> : null}
    {pendingOriginal ? <Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await attachOriginal(pendingOriginal.id, pendingOriginal.index); setError(''); } catch { setError('Originalfilen kunne stadig ikke gemmes. Opskriften er allerede gemt.'); } finally { setBusy(false); } }}>Prøv at vedhæfte originalen igen</Button> : null}
    {recipes.length ? <section aria-label="Importerede opskriftsudkast" className="space-y-4"><div><h2 className="text-2xl font-semibold">Dine opskriftsudkast</h2><p className="mt-1 text-ink-soft">Gennemgå ét udkast ad gangen. Manglende oplysninger skal kontrolleres i originalen.</p></div>{recipes.map((r, i) => <Card className="p-5 sm:p-6" key={i}><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-xl font-semibold">{r.title}</h3><Badge tone={saved[i] ? 'sage' : 'honey'}>{saved[i] ? 'Gemt i kogebogen' : 'Udkast'}</Badge></div>{r.description ? <p className="mt-2 text-ink-soft">{r.description}</p> : null}<div className="mt-3 flex flex-wrap gap-2"><Badge>{r.ingredients.length} ingredienser</Badge><Badge>{r.steps.length} trin</Badge>{r.servings ? <Badge>{r.servings} {r.yield_unit || 'personer'}</Badge> : null}{r.total_minutes !== null ? <Badge>{r.total_minutes} min. i alt</Badge> : null}</div>{r.warnings.length ? <div className="mt-4"><Alert tone="info"><p className="font-medium">Kontrollér i originalen</p><ul className="mt-2 list-disc space-y-1 pl-5">{r.warnings.map((w, j) => <li key={j}>{w}</li>)}</ul></Alert></div> : null}<details className="mt-4 rounded-xl border border-line p-4"><summary className="cursor-pointer font-medium text-brand-dark">Se ingredienser og fremgangsmåde</summary><div className="mt-4 grid gap-6 md:grid-cols-2"><div><h4 className="font-semibold">Ingredienser</h4><ul className="mt-2 list-disc space-y-2 pl-5">{r.ingredients.map((ingredient, j) => <li key={j}>{ingredient}</li>)}</ul></div><div><h4 className="font-semibold">Fremgangsmåde</h4><ol className="mt-2 list-decimal space-y-3 pl-5">{r.steps.map((step, j) => <li className="whitespace-pre-line" key={j}>{step}</li>)}</ol></div></div>{r.notes ? <div className="mt-5"><h4 className="font-semibold">Gode råd og noter</h4><p className="mt-2 whitespace-pre-line text-ink-soft">{r.notes}</p></div> : null}</details><div className="mt-5">{saved[i] ? <Link className="font-medium text-brand-dark underline" href={`/recipes/${saved[i]}`}>Åbn gemt opskrift</Link> : <Button disabled={busy || !!pendingOriginal} onClick={() => setSelected(i)}>Gennemgå og redigér</Button>}</div></Card>)}</section> : null}
  </div>;
}

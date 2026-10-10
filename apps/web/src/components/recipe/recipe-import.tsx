'use client';
import { useState } from 'react';
import Link from 'next/link';
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
    return <div className="space-y-5"><button className="min-h-12 underline" onClick={() => setSelected(null)}>Tilbage til udkast (ugemte ændringer mistes)</button>
      <p>Kontrollér alle felter før gemning. Originalkilden bevares; AI kan have læst forkert.</p>
      {recipe.warnings.length ? <ul className="list-disc pl-5">{recipe.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
      <RecipeEditor key={selected} initial={draft} mode="create" categories={categories} people={people} onSaved={afterSave} />
    </div>;
  }
  return <div className="space-y-6">
    <p>Importér PDF, billeder, fotos, screenshots, hjemmesider eller tekst. Kilden sendes til AI, når automatisk udtræk ikke er nok. Du gennemgår hvert udkast før gemning.</p>
    <p className="text-sm">Maks. 5 MB pr. fil og 10 opskrifter pr. import. Udkastene er kun i denne åbne side. For billeder bevares en læsbar kopi uden GPS/EXIF; PDF bevares uændret.</p>
    <label className="block">Importtype<select className="ml-3 rounded border p-3" value={kind} disabled={busy} onChange={e => setKind(e.target.value as typeof kind)}><option value="file">Fil / billede / PDF</option><option value="url">Hjemmeside</option><option value="text">Indsæt tekst</option></select></label>
    {kind === 'file' ? <><label className="block">Vælg fil<input className="mt-2 block" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,text/plain" disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><label className="block">Tag et billede<input className="mt-2 block" type="file" accept="image/*" capture="environment" disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>{file ? <p>{file.name}</p> : null}</> : kind === 'url' ? <label className="block">Opskriftens URL<input className="mt-2 w-full rounded border p-3" type="url" value={url} disabled={busy} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></label> : <label className="block">Opskriftstekst<textarea className="mt-2 w-full rounded border p-3" rows={12} maxLength={60000} value={text} disabled={busy} onChange={e => setText(e.target.value)} /></label>}
    <button className="min-h-12 rounded-full bg-brand px-6 text-white disabled:opacity-50" disabled={busy || !!pendingOriginal} onClick={() => void extract()}>{busy ? 'Læser opskriften…' : 'Opret udkast'}</button>
    {error ? <p role="alert">{error}</p> : null}
    {pendingOriginal ? <button className="min-h-12 underline" disabled={busy} onClick={async () => { setBusy(true); try { await attachOriginal(pendingOriginal.id, pendingOriginal.index); setError(''); } catch { setError('Originalfilen kunne stadig ikke gemmes. Opskriften er allerede gemt.'); } finally { setBusy(false); } }}>Prøv at vedhæfte originalen igen</button> : null}
    <ul className="space-y-3">{recipes.map((r, i) => <li className="rounded-xl border p-4" key={i}><h2 className="text-xl font-semibold">{r.title}</h2><p>{r.ingredients.length} ingredienser · {r.steps.length} trin · {r.warnings.length} punkter til kontrol</p>{saved[i] ? <Link className="underline" href={`/recipes/${saved[i]}`}>Åbn gemt opskrift</Link> : <button className="min-h-12 underline" disabled={!!pendingOriginal} onClick={() => setSelected(i)}>Gennemgå og redigér</button>}</li>)}</ul>
  </div>;
}

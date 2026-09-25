'use client';
import { addMediaRow, deleteMedia, setCoverMedia, toDataError } from '@vores-kok/database';
import { buildMediaPath, MEDIA_BUCKET, MEDIA_KINDS, MEDIA_KIND_LABELS, validateUpload, type MediaKind } from '@vores-kok/domain';
import type { RecipeMedia } from '@vores-kok/validation';
import { Camera, FileText, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { prepareUpload } from '@/lib/image';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Field, Input, Select, Spinner } from '../ui';

export function MediaSection({ recipeId, householdId, media, urls, canEdit, defaultKind = 'photo', title = 'Billeder' }: {
  recipeId: string; householdId: string; media: RecipeMedia[]; urls: Record<string, string>; canEdit: boolean; defaultKind?: MediaKind; title?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<MediaKind>(defaultKind);
  const [caption, setCaption] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [pending, start] = useTransition();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(undefined);
    setInfo(undefined);
    start(async () => {
      const db = getBrowserClient();
      for (const file of Array.from(files)) {
        const problem = validateUpload(file);
        if (problem) { setError(`${file.name}: ${problem}`); continue; }
        try {
          const prepared = await prepareUpload(file);
          const path = buildMediaPath(householdId, 'recipes', recipeId, crypto.randomUUID(), prepared.mime);
          const { error: upErr } = await db.storage.from(MEDIA_BUCKET).upload(path, prepared.blob, { contentType: prepared.mime, upsert: false });
          if (upErr) throw upErr;
          await addMediaRow(db, {
            recipe_id: recipeId, household_id: householdId, storage_path: path, mime_type: prepared.mime, kind,
            byte_size: prepared.blob.size, width: prepared.width, height: prepared.height,
            caption: caption || null, approx_year: year ? Number(year) : null,
            is_cover: kind === 'photo' && !media.some((m) => m.is_cover),
          });
          if (!prepared.stripped) setInfo('HEIC-billedet blev gemt uændret (din browser kan ikke omkode det), så metadata er bevaret.');
        } catch (e) {
          setError(e instanceof Error && e.message.startsWith('Billedet') ? e.message : toDataError(e).message);
        }
      }
      setCaption('');
      setYear('');
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    });
  }

  const shown = media;
  return (
    <section aria-labelledby={`media-${defaultKind}`}>
      <h2 id={`media-${defaultKind}`} className="mb-4 text-2xl font-semibold">{title}</h2>
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((m) => {
            const url = urls[m.storage_path];
            return (
              <li key={m.id} className="group relative overflow-hidden rounded-xl border border-line bg-sand">
                {m.mime_type === 'application/pdf' ? (
                  <a href={url} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-2 text-ink-soft hover:text-brand">
                    <FileText className="size-10" aria-hidden /> PDF
                  </a>
                ) : url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                    <img src={url} alt={m.caption ?? MEDIA_KIND_LABELS[m.kind]} loading="lazy" className="aspect-square w-full object-cover" />
                  </a>
                ) : <div className="aspect-square" />}
                <div className="flex items-start justify-between gap-1 bg-paper px-2.5 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-ink-soft">{MEDIA_KIND_LABELS[m.kind]}{m.approx_year ? ` · ca. ${m.approx_year}` : ''}</div>
                    {m.caption ? <div className="truncate text-ink-muted">{m.caption}</div> : null}
                  </div>
                  {m.is_cover ? <Star className="size-4 shrink-0 fill-honey text-honey" aria-label="Forsidebillede" /> : null}
                </div>
                {canEdit ? (
                  <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    {!m.is_cover && m.mime_type.startsWith('image/') ? (
                      <button type="button" className="rounded-full bg-paper/95 p-2 shadow" aria-label="Brug som forsidebillede"
                        onClick={() => start(async () => { try { await setCoverMedia(getBrowserClient(), recipeId, m.id); router.refresh(); } catch (e) { setError(toDataError(e).message); } })}>
                        <Star className="size-4" />
                      </button>
                    ) : null}
                    <button type="button" className="rounded-full bg-paper/95 p-2 text-danger shadow" aria-label="Slet billede"
                      onClick={() => { if (confirm('Slet dette billede?')) start(async () => { try { await deleteMedia(getBrowserClient(), m.id, m.storage_path); router.refresh(); } catch (e) { setError(toDataError(e).message); } }); }}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="text-ink-muted">Ingen billeder endnu.</p>}

      {canEdit ? (
        <div className="no-print mt-4 rounded-xl border border-dashed border-line bg-paper/60 p-4">
          {error ? <div className="mb-3"><Alert>{error}</Alert></div> : null}
          {info ? <div className="mb-3"><Alert tone="info">{info}</Alert></div> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type" htmlFor={`kind-${defaultKind}`}>
              <Select id={`kind-${defaultKind}`} value={kind} onChange={(e) => setKind(e.target.value as MediaKind)}>
                {MEDIA_KINDS.map((k) => <option key={k} value={k}>{MEDIA_KIND_LABELS[k]}</option>)}
              </Select>
            </Field>
            <Field label="Billedtekst (valgfri)" htmlFor={`cap-${defaultKind}`}><Input id={`cap-${defaultKind}`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={1000} /></Field>
            <Field label="Cirka år (valgfri)" htmlFor={`yr-${defaultKind}`}><Input id={`yr-${defaultKind}`} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Fx 1962" /></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
            <Button variant="secondary" disabled={pending} onClick={() => fileRef.current?.click()}>{pending ? <Spinner /> : <ImagePlus className="size-4" aria-hidden />} Vælg filer</Button>
            <Button variant="ghost" disabled={pending} onClick={() => cameraRef.current?.click()} className="sm:hidden"><Camera className="size-4" aria-hidden /> Tag billede</Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">JPG, PNG, WebP, HEIC eller PDF op til 25 MB. Billeder gemmes privat i husstanden, og placeringsdata fjernes.</p>
        </div>
      ) : null}
    </section>
  );
}

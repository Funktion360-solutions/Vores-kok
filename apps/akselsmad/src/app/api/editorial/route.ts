import { NextResponse } from 'next/server';
import { sameOrigin, publisherApi, failure } from '@/lib/api';
import { uuid } from '@/lib/personal';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const s = await publisherApi();
  if (!s) return failure('Log ind med en redaktørkonto.', 403);
  try {
    const raw = await request.text();
    if (raw.length > 220000) return failure('Artiklen er for stor.', 413);
    const body = JSON.parse(raw);
    if (!body || (body.id != null && !uuid(body.id))) return failure('Ugyldigt artikelvalg.');
    let result;
    if (body.action === 'save') {
      result = await s.client.rpc('am_save_article', {
        p_id: body.id || null,
        p_kind: body.kind,
        p_slug: body.slug,
        p_content: body.content,
        p_revision: body.revision ?? 0,
      });
    } else if (body.action === 'publish' && uuid(body.id)) {
      if (body.at && !Number.isFinite(Date.parse(body.at)))
        return failure('Vælg et gyldigt tidspunkt.');
      result = await s.client.rpc('am_publish_article', {
        p_id: body.id,
        p_revision: body.revision,
        p_confirm: body.confirm === true,
        p_at: body.at || null,
      });
    } else if (body.action === 'unpublish' && uuid(body.id)) {
      // Revision match prevents hiding a newer publication from another window.
      result = await s.client
        .from('am_articles')
        .update({ visible: false })
        .eq('id', body.id)
        .eq('published_revision', body.publishedRevision)
        .select('id')
        .single();
    } else return failure('Ukendt handling.');
    if (result.error)
      return failure(
        result.error.code === 'VK409' || result.error.code === 'PGRST116'
          ? 'Indholdet er ændret i et andet vindue. Genindlæs før du fortsætter.'
          : result.error.code === '23505'
            ? 'Adressen er allerede brugt. Vælg en anden.'
            : 'Kontrollér titel, adresse, tekst, billeder og opskriftsvalg.',
        result.error.code === 'VK409' ? 409 : 400,
      );
    return NextResponse.json({ id: result.data });
  } catch {
    return failure('Artiklen kunne ikke behandles.');
  }
}

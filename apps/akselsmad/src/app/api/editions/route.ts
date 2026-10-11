import { NextResponse } from 'next/server';
import { sameOrigin, publisherApi, failure } from '@/lib/api';
import { uuid } from '@/lib/personal';
import { validEdition } from '@/lib/editions';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const session = await publisherApi();
  if (!session) return failure('Log ind som redaktør.', 403);
  try {
    const raw = await request.text();
    if (raw.length > 220000) return failure('Udgivelsen er for stor.', 413);
    const b = JSON.parse(raw);
    if (
      !b ||
      !['save', 'publish', 'unpublish'].includes(b.action) ||
      (b.id != null && !uuid(b.id)) ||
      !Number.isInteger(b.revision) ||
      b.revision < 0
    )
      return failure('Ugyldigt valg.');
    if (
      b.action === 'save' &&
      (!validEdition(b.content) ||
        !['course', 'book'].includes(b.kind) ||
        typeof b.slug !== 'string' ||
        !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.slug) ||
        b.slug.length > 160)
    )
      return failure('Kontrollér titel, adresse, kapitler og indhold.');
    if (b.action !== 'save' && !uuid(b.id)) return failure('Gem kladden først.');
    const { data, error } = await session.client.rpc('am_edit_edition', {
      p_id: b.id || null,
      p_kind: b.kind || null,
      p_slug: b.slug || null,
      p_content: b.content || null,
      p_revision: b.revision,
      p_action: b.action,
      p_confirm: b.confirm === true,
    });
    if (error)
      return failure(
        error.code === 'VK409'
          ? 'Kladden er ændret i et andet vindue. Genindlæs siden.'
          : error.code === '23505'
            ? 'Adressen er allerede brugt.'
            : error.code === 'VK422'
              ? 'Et kapitel er tomt, eller en opskrift eller guide er ikke offentlig. Kontrollér indholdet.'
              : 'Handlingen kunne ikke gennemføres. Kontrollér felterne og godkendelsen.',
        error.code === 'VK409' ? 409 : 400,
      );
    return NextResponse.json({ id: data });
  } catch {
    return failure('Udgivelsen kunne ikke behandles.');
  }
}

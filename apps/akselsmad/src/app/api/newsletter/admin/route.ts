import { NextResponse } from 'next/server';
import { sameOrigin, publisherApi, failure } from '@/lib/api';
import {
  newsletterUuid,
  validateNewsletter,
  renderNewsletter,
  type NewsletterCampaign,
} from '@/lib/newsletter';
import { newsletterItems } from '@/lib/newsletter-data';
import {
  newsletterConfig,
  newsletterAudience,
  createBroadcast,
  getBroadcast,
  matchBroadcast,
  sendBroadcast,
  testNewsletter,
} from '@/lib/newsletter-resend';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const auth = await publisherApi();
  if (!auth) return failure('Du har ikke adgang.', 403);
  const { client, user } = auth;
  let p;
  try {
    p = await request.json();
  } catch {
    return failure('Ugyldig forespørgsel.');
  }
  if (Number(request.headers.get('content-length') || 0) > 60000)
    return failure('Brevet er for stort.');
  const rpc = async (action: string, payload: Record<string, unknown>) => {
    const r = await client.rpc('am_newsletter_campaign', { p_action: action, p_payload: payload });
    if (r.error)
      throw Error(
        r.error.code === 'VK409'
          ? 'Brevet er ændret eller behandles allerede. Genindlæs siden.'
          : 'Ændringen blev ikke gemt. Kontrollér indhold og adgang.',
      );
    return r.data as NewsletterCampaign;
  };
  try {
    if (p.action === 'audience') return NextResponse.json(await newsletterAudience(p.after));
    if (p.action === 'preview') {
      if (newsletterUuid(p.id)) {
        const { data: frozen, error } = await client
          .from('am_newsletter_campaigns')
          .select('status,html_body,text_body')
          .eq('id', p.id)
          .eq('owner_id', user.id)
          .single();
        if (error || !frozen) return failure('Brevet blev ikke fundet.', 404);
        if (frozen.status !== 'draft')
          return NextResponse.json({ html: frozen.html_body, text: frozen.text_body });
      }
      const content = validateNewsletter(p.content);
      return NextResponse.json(
        renderNewsletter(
          content,
          await newsletterItems(),
          process.env.NEXT_PUBLIC_SITE_URL || 'https://akselsmad.dk',
        ),
      );
    }
    if (p.action === 'save') {
      if (p.id !== null && !newsletterUuid(p.id)) return failure('Ugyldigt brev.');
      return NextResponse.json({
        campaign: await rpc('save', {
          id: p.id,
          revision: p.revision,
          content: validateNewsletter(p.content),
        }),
      });
    }
    if (!newsletterUuid(p.id) || !Number.isInteger(p.revision)) return failure('Ugyldigt brev.');
    const { data, error } = await client
      .from('am_newsletter_campaigns')
      .select('*')
      .eq('id', p.id)
      .eq('owner_id', user.id)
      .single();
    if (error || !data) return failure('Brevet blev ikke fundet.', 404);
    let c = data as NewsletterCampaign;
    if (c.revision !== p.revision) return failure('Brevet er ændret. Genindlæs siden.', 409);
    if (p.action === 'test') {
      if (!user.email || !user.email_confirmed_at || !newsletterUuid(p.nonce))
        return failure('En bekræftet redaktørmail kræves.');
      c = await rpc('test', { id: c.id, revision: c.revision });
      const rendered =
        c.html_body && c.text_body
          ? {
              html: c.html_body.replaceAll(
                '{{{RESEND_UNSUBSCRIBE_URL}}}',
                new URL('/nyhedsbrev', newsletterConfig().site).href,
              ),
              text: c.text_body.replaceAll(
                '{{{RESEND_UNSUBSCRIBE_URL}}}',
                new URL('/nyhedsbrev', newsletterConfig().site).href,
              ),
            }
          : renderNewsletter(
              c.content,
              await newsletterItems(),
              newsletterConfig().site,
              new URL('/nyhedsbrev', newsletterConfig().site).href,
            );
      await testNewsletter(
        user.email,
        c.content.subject,
        rendered.html,
        rendered.text,
        `am-test-${c.id}-${c.revision}-${p.nonce}`,
      );
      return NextResponse.json({
        campaign: c,
        message: 'Testmail accepteret til ' + user.email + '.',
      });
    }
    if (p.action === 'prepare') {
      const config = newsletterConfig();
      const rendered = renderNewsletter(c.content, await newsletterItems(), config.site);
      c = await rpc('prepare', {
        id: c.id,
        revision: c.revision,
        ...rendered,
        sender: config.from,
        reply_to: config.reply,
        segment_id: config.segment,
      });
      // Claim and freeze first. Unknown provider outcomes must never create a second broadcast.
      const provider = await createBroadcast(c);
      c = await rpc('attach', { id: c.id, revision: c.revision, provider_id: provider });
    } else if (p.action === 'attach') {
      if (c.status !== 'preparing' || !newsletterUuid(p.provider_id))
        return failure('Ugyldig Resend-kladde.');
      const b = await getBroadcast(p.provider_id);
      matchBroadcast(c, b);
      if (b.status !== 'draft') return failure('Brevet skal være en kladde i Resend.');
      c = await rpc('attach', { id: c.id, revision: c.revision, provider_id: p.provider_id });
    } else if (p.action === 'send') {
      if (c.status !== 'ready' || p.confirm !== true || !c.provider_id)
        return failure('Godkend det færdige brev før afsendelse.');
      if (c.segment_id !== newsletterConfig().segment)
        return failure(
          'Brevet bruger et andet modtagersegment end den nuværende opsætning. Kontrollér Resend.',
        );
      const b = await getBroadcast(c.provider_id);
      matchBroadcast(c, b);
      if (b.status !== 'draft')
        return failure('Brevet er ikke længere en Resend-kladde. Opdatér status.');
      c = await rpc('send', { id: c.id, revision: c.revision, confirm: true });
      await sendBroadcast(c.provider_id!);
      c = await rpc('submitted', { id: c.id, revision: c.revision });
    } else if (p.action === 'status') {
      if (!c.provider_id) return failure('Kontrollér kladden i Resend og forbind dens ID her.');
      const b = await getBroadcast(c.provider_id);
      if (b.status === 'sent' && ['ready', 'sending', 'submitted'].includes(c.status))
        c = await rpc('sent', { id: c.id, revision: c.revision });
      return NextResponse.json({
        campaign: c,
        message:
          'Status hos Resend: ' + b.status + '. Afsendelse er ikke en kvittering for levering.',
      });
    } else return failure('Ukendt handling.');
    return NextResponse.json({ campaign: c });
  } catch (e) {
    return failure(e instanceof Error ? e.message : 'Handlingen kunne ikke gennemføres.', 503);
  }
}

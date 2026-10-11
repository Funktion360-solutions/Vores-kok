import 'server-only';
import { newsletterUuid, type NewsletterCampaign } from './newsletter';

type Contact = { id: string; email: string; unsubscribed: boolean };
export type Broadcast = {
  id: string;
  name: string;
  segment_id: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  reply_to: string | string[] | null;
  preview_text: string | null;
  status: string;
};
export class NewsletterProviderError extends Error {
  constructor(
    public status: number,
    message = 'Resend kunne ikke gennemføre handlingen. Kontrollér opsætningen og prøv igen senere.',
  ) {
    super(message);
  }
}
export function newsletterConfig() {
  const key = process.env.RESEND_API_KEY;
  const segment = process.env.AKSELSMAD_NEWSLETTER_SEGMENT_ID;
  const from = process.env.AKSELSMAD_NEWSLETTER_FROM;
  const reply = process.env.AKSELSMAD_NEWSLETTER_REPLY_TO || 'aksel@funktion360.dk';
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (
    !key ||
    !newsletterUuid(segment) ||
    !from ||
    /[\r\n]/.test(from) ||
    !site ||
    !/^https:\/\//.test(site) ||
    !/^\S+@\S+\.\S+$/.test(reply)
  )
    throw new NewsletterProviderError(
      503,
      'Nyhedsbrevet er ikke sat op endnu. Redaktøren skal færdiggøre mailopsætningen.',
    );
  return { key, segment, from, reply, site };
}
export function newsletterConfigured() {
  try {
    newsletterConfig();
    return true;
  } catch {
    return false;
  }
}
async function call<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
  const config = newsletterConfig();
  let response: Response;
  try {
    response = await fetch('https://api.resend.com' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + config.key,
        'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    throw new NewsletterProviderError(
      502,
      'Forbindelsen til Resend blev afbrudt. Kontrollér status før du fortsætter.',
    );
  }
  if (!response.ok)
    throw new NewsletterProviderError(
      response.status,
      response.status === 429
        ? 'Resend har midlertidigt begrænset antallet af kald. Vent lidt og prøv igen.'
        : undefined,
    );
  try {
    return (await response.json()) as T;
  } catch {
    throw new NewsletterProviderError(502);
  }
}
async function contact(email: string) {
  try {
    return await call<Contact>('/contacts/' + encodeURIComponent(email));
  } catch (e) {
    if (e instanceof NewsletterProviderError && e.status === 404) return null;
    throw e;
  }
}
export async function subscriptionState(email: string) {
  const c = await contact(email);
  if (!c || c.unsubscribed) return { subscribed: false, globallyUnsubscribed: !!c?.unsubscribed };
  const segment = newsletterConfig().segment;
  let after = '';
  for (let page = 0; page < 10; page++) {
    const r = await call<{ data: { id: string }[]; has_more: boolean }>(
      '/contacts/' + encodeURIComponent(c.id) + '/segments?limit=100' + after,
    );
    if (r.data.some((i) => i.id === segment))
      return { subscribed: true, globallyUnsubscribed: false };
    if (!r.has_more) return { subscribed: false, globallyUnsubscribed: false };
    if (!r.data.length) break;
    after = '&after=' + encodeURIComponent(r.data.at(-1)!.id);
  }
  throw new NewsletterProviderError(
    502,
    'Din tilmelding kunne ikke kontrolleres. Prøv igen senere.',
  );
}
export async function changeSubscription(email: string, subscribe: boolean) {
  const config = newsletterConfig();
  const c = await contact(email);
  if (subscribe) {
    if (c?.unsubscribed)
      throw new NewsletterProviderError(
        409,
        'Din e-mail er afmeldt hos Resend. Kontakt Aksel, hvis du vil tilmeldes igen.',
      );
    if (!c) {
      await call('/contacts', 'POST', {
        email,
        unsubscribed: false,
        segments: [{ id: config.segment }],
      });
      return;
    }
    await call('/contacts/' + encodeURIComponent(c.id) + '/segments/' + config.segment, 'POST');
  } else if (c) {
    try {
      await call('/contacts/' + encodeURIComponent(c.id) + '/segments/' + config.segment, 'DELETE');
    } catch (e) {
      if (!(e instanceof NewsletterProviderError && e.status === 404)) throw e;
    }
  }
}
export async function newsletterAudience(after?: string) {
  if (after && !newsletterUuid(after)) throw Error('Ugyldig side.');
  return call<{ data: Contact[]; has_more: boolean }>(
    '/segments/' +
      newsletterConfig().segment +
      '/contacts?limit=100' +
      (after ? '&after=' + after : ''),
  );
}
export async function createBroadcast(c: NewsletterCampaign) {
  const result = await call<{ id: string }>('/broadcasts', 'POST', {
    name: 'AkselsMad:' + c.id,
    segment_id: c.segment_id,
    from: c.sender,
    reply_to: c.reply_to,
    subject: c.content.subject,
    preview_text: c.content.preheader,
    html: c.html_body,
    text: c.text_body,
    send: false,
  });
  if (!newsletterUuid(result.id)) throw new NewsletterProviderError(502);
  return result.id;
}
export async function getBroadcast(id: string) {
  if (!newsletterUuid(id)) throw Error('Ugyldigt brev.');
  return call<Broadcast>('/broadcasts/' + id);
}
export function matchBroadcast(c: NewsletterCampaign, b: Broadcast) {
  const reply = Array.isArray(b.reply_to) ? b.reply_to.join(',') : b.reply_to;
  if (
    b.name !== 'AkselsMad:' + c.id ||
    b.segment_id !== c.segment_id ||
    b.from !== c.sender ||
    b.subject !== c.content.subject ||
    b.html !== c.html_body ||
    b.text !== c.text_body ||
    reply !== c.reply_to ||
    (b.preview_text || '') !== c.content.preheader
  )
    throw Error(
      'Brevet i Resend matcher ikke den godkendte kladde. Kontrollér det i Resend før du fortsætter.',
    );
}
export async function sendBroadcast(id: string) {
  const r = await call<{ id: string }>('/broadcasts/' + id + '/send', 'POST', {});
  if (r.id !== id) throw new NewsletterProviderError(502);
}
export async function testNewsletter(
  email: string,
  subject: string,
  html: string,
  text: string,
  id: string,
) {
  const c = newsletterConfig();
  return call<{ id: string }>(
    '/emails',
    'POST',
    { from: c.from, to: [email], reply_to: c.reply, subject: '[TEST] ' + subject, html, text },
    id,
  );
}

import { inlineText, textBlocks } from './rich-text';
export const newsletterConsent =
  'Ja tak, jeg vil modtage AkselsMads nyhedsbrev med opskrifter, guides og nyt fra Aksels køkken. Jeg kan afmelde mig når som helst.';
export type NewsletterContent = {
  subject: string;
  preheader: string;
  title: string;
  intro: string;
  closing: string;
  items: { kind: 'recipe' | 'guide' | 'blog'; id: string }[];
};
export type NewsletterItem = {
  kind: 'recipe' | 'guide' | 'blog';
  id: string;
  title: string;
  excerpt: string;
  href: string;
};
export type NewsletterCampaign = {
  id: string;
  content: NewsletterContent;
  revision: number;
  status: 'draft' | 'preparing' | 'ready' | 'sending' | 'submitted' | 'sent';
  provider_id: string | null;
  html_body: string | null;
  text_body: string | null;
  sender: string | null;
  reply_to: string | null;
  segment_id: string | null;
  updated_at: string;
};
export const newsletterStatus = {
  draft: 'Kladde',
  preparing: 'Kontrollér Resend-kladde',
  ready: 'Klar til godkendelse',
  sending: 'Afsendelse skal kontrolleres',
  submitted: 'Accepteret til udsendelse',
  sent: 'Udsendt',
};
export const newsletterUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateNewsletter(value: unknown): NewsletterContent {
  if (!value || typeof value !== 'object') throw Error('Ugyldigt nyhedsbrev.');
  const c = value as NewsletterContent;
  const bounds = { subject: 200, preheader: 180, title: 180, intro: 10000, closing: 3000 } as const;
  for (const [key, max] of Object.entries(bounds)) {
    const text = c[key as keyof typeof bounds];
    if (
      typeof text !== 'string' ||
      text.length > max ||
      text.includes('{{') ||
      (key === 'subject' && /[\r\n]/.test(text))
    )
      throw Error('Kontrollér tekstfelternes længde og indhold.');
  }
  if (
    !c.subject.trim() ||
    !c.title.trim() ||
    !c.intro.trim() ||
    !Array.isArray(c.items) ||
    c.items.length > 6
  )
    throw Error('Udfyld emne, overskrift og indledning. Vælg højst seks indslag.');
  if (
    c.items.some(
      (i) => !i || !['recipe', 'guide', 'blog'].includes(i.kind) || !newsletterUuid(i.id),
    ) ||
    new Set(c.items.map((i) => i.kind + ':' + i.id)).size !== c.items.length
  )
    throw Error('Kontrollér dine indslag.');
  return {
    subject: c.subject.trim(),
    preheader: c.preheader.trim(),
    title: c.title.trim(),
    intro: c.intro.trim(),
    closing: c.closing.trim(),
    items: c.items.map((i) => ({ kind: i.kind, id: i.id })),
  };
}
const escape = (s: string) =>
  s.replace(
    /[&<>"'{}]/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '{': '&#123;',
        '}': '&#125;',
      })[c]!,
  );
function inline(s: string) {
  return inlineText(s)
    .map((p) =>
      p.kind === 'bold'
        ? `<strong>${escape(p.text)}</strong>`
        : p.kind === 'italic'
          ? `<em>${escape(p.text)}</em>`
          : p.kind === 'code'
            ? `<code>${escape(p.text)}</code>`
            : escape(p.text),
    )
    .join('')
    .replace(/\n/g, '<br>');
}
function rich(s: string) {
  return textBlocks(s)
    .map((b) =>
      b.kind === 'ul' || b.kind === 'ol'
        ? `<${b.kind} style="padding-left:24px;margin:0 0 20px;line-height:1.85">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${b.kind}>`
        : b.kind === 'heading'
          ? `<h2 style="font-family:Georgia,serif;font-size:23px;line-height:1.4;margin:24px 0 12px">${inline(b.text)}</h2>`
          : `<p style="margin:0 0 20px;line-height:1.85;${b.kind === 'quote' ? 'border-left:3px solid #abc9d9;padding-left:16px;font-style:italic;' : ''}">${inline('text' in b ? b.text : '')}</p>`,
    )
    .join('');
}
export function renderNewsletter(
  c: NewsletterContent,
  items: NewsletterItem[],
  site: string,
  unsubscribe = '{{{RESEND_UNSUBSCRIBE_URL}}}',
) {
  const base = new URL(site);
  if (base.protocol !== 'https:' && base.hostname !== 'localhost')
    throw Error('Hjemmesideadressen skal bruge HTTPS.');
  const chosen = c.items.map((i) => {
    const found = items.find((x) => x.kind === i.kind && x.id === i.id);
    if (!found)
      throw Error('Et valgt indslag er ikke længere offentligt. Vælg et andet og gem igen.');
    const url = new URL(found.href, base);
    if (url.origin !== base.origin || !/^\/(opskrifter|guides|blog)\//.test(url.pathname))
      throw Error('Ugyldigt indslagslink.');
    return found;
  });
  const cards = chosen
    .map(
      (i) =>
        `<tr><td style="padding:0 28px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#f5f0e8" style="padding:24px;background:#f5f0e8;border:1px solid #e7ded0;border-radius:12px"><p style="font-size:11px;letter-spacing:2px;color:#637c83;text-transform:uppercase;margin:0 0 8px">${i.kind === 'recipe' ? 'Fra kogebogen' : i.kind === 'guide' ? 'Guide til dit køkken' : 'Fra min blog'}</p><h2 style="font-family:Georgia,serif;font-size:25px;line-height:1.4;margin:0 0 12px;color:#353b36">${escape(i.title)}</h2><p style="font-size:15px;line-height:1.8;margin:0 0 20px;color:#626c63">${escape(i.excerpt.slice(0, 350))}</p><a href="${escape(new URL(i.href, base).href)}" style="display:inline-block;background:#466c80;border-radius:5px;padding:12px 18px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">${i.kind === 'recipe' ? 'Se opskriften' : 'Læs videre'} &rarr;</a></td></tr></table></td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(c.subject)}</title></head><body style="margin:0;padding:0;background:#eee4d5;font-family:Arial,Helvetica,sans-serif;color:#353b36"><div style="display:none;font-size:1px;max-height:0;opacity:0;overflow:hidden;mso-hide:all">${escape(c.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eee4d5"><tr><td align="center" style="padding:30px 12px"><table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbf8f2" style="width:100%;max-width:620px;background:#fbf8f2;border:1px solid #e0d5c5;border-radius:16px;overflow:hidden"><tr><td bgcolor="#dcebf1" style="padding:32px 28px;background:#dcebf1;border-bottom:1px solid #cadce5"><a href="${escape(base.origin)}" style="font-family:Georgia,serif;font-size:38px;letter-spacing:-2px;font-weight:bold;text-decoration:none;color:#353b36">Aksels<span style="color:#466c80">Mad</span></a><p style="font-size:10px;letter-spacing:3px;margin:8px 0 0;color:#57727e">ET BREV FRA AKSELS KØKKEN</p></td></tr><tr><td style="padding:32px 28px 8px"><h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.35;font-weight:normal;margin:0 0 26px;color:#353b36">${escape(c.title)}</h1><div style="font-size:16px;color:#4b554d">${rich(c.intro)}</div></td></tr>${cards}<tr><td style="padding:4px 28px 28px;font-size:16px;color:#4b554d">${rich(c.closing)}<p style="font-family:Georgia,serif;font-size:22px;line-height:1.6;margin:22px 0 0">God fornøjelse i køkkenet.<br><strong>Aksel</strong></p></td></tr><tr><td style="padding:22px 28px;background:#f1eadf;border-top:1px solid #e0d5c5;font-size:12px;line-height:1.85;color:#6a7169"><p style="margin:0 0 10px">Du får dette brev, fordi du har tilmeldt dig AkselsMads nyhedsbrev.</p><a href="${unsubscribe === '{{{RESEND_UNSUBSCRIBE_URL}}}' ? unsubscribe : escape(unsubscribe)}" style="color:#466c80">Afmeld nyhedsbreve</a> &nbsp;·&nbsp; <a href="${escape(new URL('/privatliv', base).href)}" style="color:#466c80">Privatliv</a><p style="margin:12px 0 0">AkselsMad · Aksel Slot · Funktion360<br><a href="${escape(base.origin)}" style="color:#466c80">${escape(base.hostname)}</a></p></td></tr></table></td></tr></table></body></html>`;
  const text = [
    c.title,
    c.intro,
    ...chosen.map((i) => `${i.title}\n${i.excerpt}\n${new URL(i.href, base).href}`),
    c.closing,
    'God fornøjelse i køkkenet.\nAksel',
    'Du får dette brev, fordi du har tilmeldt dig AkselsMad.\nAfmeld nyhedsbreve: ' + unsubscribe,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { html, text };
}

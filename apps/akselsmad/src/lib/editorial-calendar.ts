import { articleStatus, type Article, type ArticleDraft } from './editorial';
const zone = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function danishDay(value: string | number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = zone.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function calendarMonth(value: unknown, now = Date.now()) {
  return typeof value === 'string' && /^(20[0-9]{2})-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : danishDay(now).slice(0, 7);
}
export function monthDays(month: string) {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  const first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) =>
    new Date(Date.UTC(year, number - 1, 1 - offset + i)).toISOString().slice(0, 10),
  );
}
export function shiftMonth(month: string, offset: number) {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  const shifted = new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
  return shifted < '2000-01' || shifted > '2099-12' ? month : shifted;
}
export function calendarEntries(drafts: ArticleDraft[], published: Article[], now = Date.now()) {
  const live = new Map(published.map((a) => [a.id, a]));
  return drafts.map((draft) => {
    const article = live.get(draft.id);
    const visible = article?.visible === true;
    return {
      draft,
      article,
      status: articleStatus(article, draft.revision, now),
      day: visible ? danishDay(article.published_at) : '',
      changed: visible && article.published_revision !== draft.revision,
    };
  });
}

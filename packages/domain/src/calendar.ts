/** Calendar helpers for the meal planner (Danish weeks start on Monday, ISO 8601). */

export const WEEKDAY_LABELS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'] as const;
export const WEEKDAY_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] as const;
const MONTHS_SHORT = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const MEAL_SLOT_LABELS: Record<MealSlot, string> = { breakfast: 'Morgenmad', lunch: 'Frokost', dinner: 'Aftensmad', snack: 'Mellemmåltid' };

/** Parses "YYYY-MM-DD" as a local calendar date (no timezone shifts). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Monday of the week containing the date. */
export function startOfWeek(key: string): string {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(key, -dow);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** ISO 8601 week number. */
export function isoWeek(key: string): number {
  const d = parseDateKey(key);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function weekdayIndex(key: string): number {
  return (parseDateKey(key).getDay() + 6) % 7;
}

/** "Mandag 28. sep." */
export function formatDayLabel(key: string, short = false): string {
  const d = parseDateKey(key);
  const wd = short ? WEEKDAY_SHORT[weekdayIndex(key)] : WEEKDAY_LABELS[weekdayIndex(key)];
  return `${wd} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Uge 40 · 28. sep. – 4. okt." */
export function formatWeekLabel(weekStart: string): string {
  const a = parseDateKey(weekStart);
  const b = parseDateKey(addDays(weekStart, 6));
  return `Uge ${isoWeek(weekStart)} · ${a.getDate()}. ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()}. ${MONTHS_SHORT[b.getMonth()]}`;
}

/** Today's date key; pass a time zone on servers (defaults to the device's zone). */
export function todayKey(now: Date = new Date(), timeZone?: string): string {
  if (!timeZone) return toDateKey(now);
  return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const HOME_TIME_ZONE = 'Europe/Copenhagen';

/** Days until a best-before date (negative = expired). */
export function daysUntil(dateKey: string, today: string = todayKey()): number {
  return Math.round((parseDateKey(dateKey).getTime() - parseDateKey(today).getTime()) / 86400000);
}

export type ExpiryState = 'expired' | 'today' | 'soon' | 'ok' | 'none';
export function expiryState(bestBefore: string | null | undefined, today?: string): ExpiryState {
  if (!bestBefore) return 'none';
  const n = daysUntil(bestBefore, today);
  if (n < 0) return 'expired';
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  return 'ok';
}

export function formatExpiry(bestBefore: string | null | undefined, today?: string): string {
  if (!bestBefore) return '';
  const n = daysUntil(bestBefore, today);
  if (n < -1) return `Udløb for ${-n} dage siden`;
  if (n === -1) return 'Udløb i går';
  if (n === 0) return 'Udløber i dag';
  if (n === 1) return 'Udløber i morgen';
  if (n <= 7) return `Udløber om ${n} dage`;
  const d = parseDateKey(bestBefore);
  return `Bedst før ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}

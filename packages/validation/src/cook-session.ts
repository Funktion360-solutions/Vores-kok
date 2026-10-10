import { z } from 'zod';
export const MAX_TIMER_SECONDS = 7 * 24 * 60 * 60;
const timerSchema = z.object({ id: z.string().max(100), label: z.string().max(200), total: z.number().int().min(1).max(MAX_TIMER_SECONDS), endsAt: z.number().finite().nullable(), remaining: z.number().int().min(0).max(MAX_TIMER_SECONDS), done: z.boolean() });
export type RunningTimer = z.infer<typeof timerSchema>;
const sessionSchema = z.object({ savedAt: z.number().finite(), index: z.number().int().min(0), finished: z.boolean(), checked: z.array(z.string().max(100)).max(200), timers: z.array(timerSchema).max(20) });
export function advanceTimers(timers: RunningTimer[], now: number): RunningTimer[] {
  return timers.map(t => {
    if (t.endsAt === null || t.done) return t;
    const remaining = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
    if (remaining === 0) return { ...t, remaining: 0, done: true, endsAt: null };
    return remaining === t.remaining ? t : { ...t, remaining };
  });
}
export function restoreCookSession(raw: string, stepCount: number, ingredientIds: string[], now = Date.now()) {
  try {
    const result = sessionSchema.safeParse(JSON.parse(raw));
    if (!result.success || now - result.data.savedAt > 24 * 60 * 60 * 1000 || result.data.savedAt > now + 60000) return null;
    const data = result.data;
    if (data.timers.some(t => t.remaining > t.total || (t.endsAt !== null && t.endsAt > now + MAX_TIMER_SECONDS * 1000))) return null;
    return { ...data, index: Math.min(data.index, Math.max(0, stepCount - 1)), checked: data.checked.filter(id => ingredientIds.includes(id)), timers: advanceTimers(data.timers, now) };
  } catch { return null; }
}

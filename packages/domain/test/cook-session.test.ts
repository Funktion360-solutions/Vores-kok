import { expect, it } from 'vitest';
import { advanceTimers, restoreCookSession, type RunningTimer } from '../../validation/src/cook-session';
const now = 1000000;
const running: RunningTimer = { id: 'timer', label: 'Bagning', total: 60, endsAt: now + 60000, remaining: 60, done: false };
it('uses absolute deadlines without rounding the timer down early', () => {
  expect(advanceTimers([running], now + 59501)[0]?.remaining).toBe(1);
  expect(advanceTimers([running], now + 60000)[0]).toMatchObject({ remaining: 0, endsAt: null, done: true });
  const paused = { ...running, endsAt: null, remaining: 12 };
  expect(advanceTimers([paused], now + 120000)).toEqual([paused]);
});
it('restores step and ingredient checks, and marks overdue timers finished', () => {
  const raw = JSON.stringify({ savedAt: now, index: 9, finished: false, checked: ['mel', 'deleted'], timers: [running] });
  expect(restoreCookSession(raw, 3, ['mel'], now + 120000)).toMatchObject({ index: 2, checked: ['mel'], timers: [{ done: true, remaining: 0 }] });
});
it('rejects stale, corrupt or implausible browser state', () => {
  expect(restoreCookSession('{', 3, [], now)).toBeNull();
  const state = { savedAt: now, index: 0, finished: false, checked: [], timers: [running] };
  expect(restoreCookSession(JSON.stringify(state), 3, [], now + 25 * 60 * 60 * 1000)).toBeNull();
  expect(restoreCookSession(JSON.stringify({ ...state, timers: [{ ...running, remaining: 999 }] }), 3, [], now)).toBeNull();
});

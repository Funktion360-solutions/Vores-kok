import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync(new URL('../src/lib/' + file, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(source, { exports, require: (id) => mocks[id] });
  return exports;
}
const editorial = load('editorial.ts', { './rich-text': {} });
const c = load('editorial-calendar.ts', { './editorial': editorial });
test('Copenhagen dates respect midnight and daylight saving', () => {
  assert.equal(c.danishDay('2026-10-31T23:30:00Z'), '2026-11-01');
  assert.equal(c.danishDay('2026-07-01T22:30:00Z'), '2026-07-02');
  assert.equal(c.danishDay('2026-03-29T01:30:00Z'), '2026-03-29');
  assert.equal(c.danishDay('bad'), '');
});
test('42-day month starts Monday, includes leap day and crosses years', () => {
  const days = c.monthDays('2024-02');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2024-01-29');
  assert.ok(days.includes('2024-02-29'));
  assert.equal(new Set(days).size, 42);
  assert.equal(c.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(c.shiftMonth('2026-01', -1), '2025-12');
});
test('invalid month input falls back to current Danish month', () => {
  const now = Date.parse('2026-10-31T23:30:00Z');
  for (const invalid of ['2026-13', '../bad', '0026-02', ['2026-03'], null])
    assert.equal(c.calendarMonth(invalid, now), '2026-11');
  assert.equal(c.calendarMonth('2027-03', now), '2027-03');
});
test('owned drafts are joined by ID and only approved visible versions get dates', () => {
  const drafts = [
    { id: 'a', revision: 2 },
    { id: 'b', revision: 1 },
    { id: 'c', revision: 1 },
    { id: 'd', revision: 3 },
  ];
  const live = [
    { id: 'a', visible: true, published_revision: 1, published_at: '2026-11-01T10:00:00Z' },
    { id: 'c', visible: false, published_revision: 1, published_at: '2026-11-02T10:00:00Z' },
    { id: 'd', visible: true, published_revision: 3, published_at: '2026-09-01T10:00:00Z' },
    { id: 'other', visible: true, published_revision: 1, published_at: '2026-11-01T10:00:00Z' },
  ];
  const entries = c.calendarEntries(drafts, live, Date.parse('2026-10-11T12:00:00Z'));
  assert.equal(entries.length, 4);
  assert.equal(entries[0].status, 'Planlagt');
  assert.equal(entries[0].changed, true);
  assert.equal(entries[1].day, '');
  assert.equal(entries[2].day, '');
  assert.equal(entries[3].status, 'Udgivet');
  assert.equal(entries[0].day, '2026-11-01');
});

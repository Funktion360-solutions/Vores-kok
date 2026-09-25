import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addDays, HOME_TIME_ZONE, todayKey } from '@vores-kok/domain';

const keys = JSON.parse(readFileSync(new URL('../../../.dev/keys.json', import.meta.url), 'utf8')) as { anon: string };
const email = `kitchen-${Date.now()}@example.com`;
const password = 'køkken-kodeord-1';
let lasagneId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const db = createClient('http://127.0.0.1:54321', keys.anon, { auth: { persistSession: false } });
  await db.auth.signUp({ email, password, options: { data: { display_name: 'Aksel' } } });
  const { data: h } = await db.rpc('create_household', { p_name: 'Køkkenet' });
  const r1 = await db.rpc('save_recipe', { p_recipe: { household_id: h, title: 'Lasagne', servings: 4, meal_types: ['dinner'],
    ingredients: [{ name: 'kartofler', quantity: 500, unit: 'g', unit_code: 'g' }, { name: 'mælk', quantity: 5, unit: 'dl', unit_code: 'dl' }, { name: 'hakket oksekød', quantity: 500, unit: 'g', unit_code: 'g' }],
    steps: [{ body: 'Brun kødet i 10 minutter.' }, { body: 'Bag lasagnen ved 200°C i 25-30 minutter.' }] } });
  lasagneId = (r1.data as { id: string }).id;
  await db.rpc('save_recipe', { p_recipe: { household_id: h, title: 'Kartoffelsuppe', servings: 4,
    ingredients: [{ name: 'Kartofler', quantity: 750, unit: 'g', unit_code: 'g' }, { name: 'porre', quantity: 1, unit: 'stk', unit_code: 'stk' }], steps: [{ body: 'Kog alt.' }] } });
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Adgangskode').fill(password);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL('/');
}

async function plan(page: Page, dayLabel: RegExp, title: string) {
  await page.getByRole('button', { name: dayLabel }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Tilføj til madplanen' });
  await dlg.getByLabel('Søg efter opskrift').fill(title);
  await dlg.getByRole('button', { name: title, exact: true }).click();
  await dlg.getByRole('button', { name: 'Gem' }).click();
  await expect(dlg).toBeHidden();
}

test('meal plan → aggregated shopping list → live ticking', async ({ page, browser }) => {
  await login(page);
  await page.goto('/plan?week=2026-09-28');
  await expect(page.getByText('Uge 40 · 28. sep. – 4. okt.')).toBeVisible();
  await plan(page, /Tilføj ret Mandag/, 'Lasagne');
  await plan(page, /Tilføj ret Tirsdag/, 'Kartoffelsuppe');
  await expect(page.getByRole('listitem', { name: /Mandag/ }).getByRole('link', { name: 'Lasagne' })).toBeVisible();

  await page.getByRole('button', { name: 'Lav indkøbsliste' }).click();
  const dlg = page.getByRole('dialog', { name: 'Tilføj til indkøbsliste' });
  // 500 g + 750 g kartofler are combined deterministically
  await expect(dlg.getByText('1¼ kg')).toBeVisible();
  await dlg.getByRole('button', { name: /Tilføj \d+ varer/ }).click();
  await dlg.getByRole('link', { name: 'Åbn listen' }).click();
  await expect(page).toHaveURL(/\/shopping\/[0-9a-f-]{36}$/);
  const listUrl = page.url();
  await expect(page.getByRole('region', { name: 'Frugt og grønt' }).getByText('kartofler')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Kød og fisk' }).getByText('hakket oksekød')).toBeVisible();

  // Manual item parsed into quantity/unit/category
  await page.getByLabel('Tilføj vare').fill('2 l juice');
  await page.getByRole('button', { name: 'Tilføj', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Drikkevarer' }).getByText('juice')).toBeVisible();

  // A second device (same household) sees the tick after the next sync.
  const other = await browser.newContext();
  const page2 = await other.newPage();
  await login(page2);
  await page2.goto(listUrl);
  await page.getByRole('checkbox', { name: /Sæt flueben ved kartofler/ }).click();
  await expect(page.getByRole('region', { name: 'I kurven (1)' })).toBeVisible();
  await expect(page2.getByRole('region', { name: /I kurven/ }).getByText('kartofler')).toBeVisible({ timeout: 25_000 });
  await other.close();
});

test('pantry: expiring items and "skip what we have"', async ({ page }) => {
  await login(page);
  await page.goto('/kitchen');
  await expect(page.getByRole('region', { name: /Køleskab/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tilføj vare' }).click();
  const dlg = page.getByRole('dialog', { name: 'Tilføj vare' });
  await dlg.getByLabel('Hvad og hvor meget').fill('1 l mælk');
  const tomorrow = addDays(todayKey(new Date(), HOME_TIME_ZONE), 1);
  await dlg.getByLabel('Bedst før').fill(tomorrow);
  await dlg.getByRole('button', { name: 'Gem' }).click();
  await expect(page.getByRole('region', { name: /Køleskab/ }).getByText('mælk')).toBeVisible();
  await expect(page.getByText('Skal bruges snart')).toBeVisible();
  await expect(page.getByText(/Udløber i morgen/).first()).toBeVisible();

  await page.goto(`/recipes/${lasagneId}`);
  await page.getByRole('button', { name: 'Til indkøbsliste' }).click();
  const add = page.getByRole('dialog', { name: 'Tilføj til indkøbsliste' });
  await expect(add.getByText('Har allerede: mælk')).toBeVisible();
  await add.getByLabel('Spring over det, vi allerede har i Mit køkken').uncheck();
  await expect(add.getByText('Har allerede')).toHaveCount(0);
});

test('cook mode: steps, scaled ingredients, timers, finish', async ({ page }) => {
  await login(page);
  await page.goto(`/recipes/${lasagneId}?servings=8`);
  await expect(page.getByRole('region', { name: 'Ingredienser' }).getByText('1 kg').first()).toBeVisible();
  await page.getByRole('link', { name: 'Start kogetilstand' }).click();
  await expect(page).toHaveURL(new RegExp(`/cook/${lasagneId}\\?servings=8`));
  await expect(page.getByText('Trin 1 af 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Brun kødet i 10 minutter.' })).toBeVisible();
  // Step-specific ingredient, scaled to 8 persons (500 g → 1 kg)
  await expect(page.getByText('I dette trin')).toBeVisible();
  await page.getByRole('button', { name: /Start timer · 10:00/ }).click();
  await expect(page.getByRole('timer')).toHaveText(/^(10:00|9:5\d)$/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Trin 2 af 2')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start timer · 30:00/ })).toBeVisible();
  await page.getByRole('button', { name: 'Færdig' }).click();
  await expect(page.getByRole('heading', { name: 'Velbekomme!' })).toBeVisible();
});

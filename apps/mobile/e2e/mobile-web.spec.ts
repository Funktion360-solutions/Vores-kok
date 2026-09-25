/**
 * Smoke test of the universal app via its web build (react-native-web): the
 * same screens, data layer and offline cache that run on iPhone/iPad.
 */
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const keys = JSON.parse(readFileSync(process.env.VK_KEYS ?? '../../.dev/keys.json', 'utf8')) as { anon: string };
const email = `mobile-${Date.now()}@example.com`;
const password = 'mobil-kodeord-1';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const db = createClient('http://127.0.0.1:54321', keys.anon, { auth: { persistSession: false } });
  await db.auth.signUp({ email, password, options: { data: { display_name: 'Aksel' } } });
  const { data: h } = await db.rpc('create_household', { p_name: 'Familien Slot' });
  await db.rpc('save_recipe', { p_recipe: { household_id: h, title: 'Kanelsnegle', servings: 16, yield_unit: 'stk', prep_minutes: 45, cook_minutes: 60, difficulty: 'medium',
    origin_text: 'Mor', ingredients: [{ name: 'hvedemel', quantity: 500, unit: 'g', unit_code: 'g' }, { name: 'mælk', quantity: 2.5, unit: 'dl', unit_code: 'dl' }], steps: [{ body: 'Opløs gæren i lun mælk.' }] } });
  await db.rpc('save_recipe', { p_recipe: { household_id: h, title: 'Rugbrød', servings: 12, ingredients: [{ name: 'rugmel', quantity: 500, unit: 'g', unit_code: 'g' }], steps: [{ body: 'Bland.' }] } });
});

test('phone: sign in, browse, scale, favorite, then read offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Adgangskode').fill(password);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page.getByText(/2 opskrifter i jeres kogebog/)).toBeVisible();
  await page.getByText('Opskrifter', { exact: true }).last().click();
  await page.getByLabel('Søg i opskrifter').fill('kanel');
  await page.getByRole('button', { name: /Kanelsnegle/ }).click();
  await expect(page.getByText('500 g').first()).toBeVisible();
  await page.getByRole('button', { name: 'Flere portioner' }).click(); // 16 → 20
  await expect(page.getByText('625 g').first()).toBeVisible();
  await page.getByRole('button', { name: 'Gem som favorit' }).click();
  await expect(page.getByRole('button', { name: 'Favorit' })).toBeVisible();

  // Offline: restart the app with the backend unreachable (the static app
  // shell still loads, as the installed native app would), then drop the
  // network entirely. Recipes must come from the device cache.
  await page.route('http://127.0.0.1:54321/**', (r) => r.abort('internetdisconnected'));
  await page.goto('/');
  await context.setOffline(true);
  await expect(page.getByText(/Offline — viser gemte opskrifter/)).toBeVisible();
  await expect(page.getByText('Rugbrød').first()).toBeVisible();
  await page.getByText('Opskrifter', { exact: true }).last().click();
  await page.getByRole('button', { name: /Rugbrød/ }).click();
  await expect(page.getByText('Bland.')).toBeVisible();
  await expect(page.getByText('Redigering kræver forbindelse.')).toBeVisible();
  await context.setOffline(false);
  await page.unroute('http://127.0.0.1:54321/**');
});

test('iPad landscape: list and recipe side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.goto('/');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Adgangskode').fill(password);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await page.getByText('Opskrifter', { exact: true }).last().click();
  await expect(page.getByText('Vælg en opskrift til venstre.')).toBeVisible();
  await page.getByRole('button', { name: /Kanelsnegle/ }).click();
  await expect(page.getByText('Opløs gæren i lun mælk.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Rugbrød/ })).toBeVisible(); // list still visible
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/ipad.png` : 'test-results/ipad.png' });
});

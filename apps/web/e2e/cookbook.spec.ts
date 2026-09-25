import { devices, expect, test, type Page } from '@playwright/test';

const { defaultBrowserType: _p, ...iphone } = devices['iPhone 15'];
const { defaultBrowserType: _t, ...ipad } = devices['iPad Pro 11 landscape'];

const stamp = Date.now();
const owner = { name: 'Aksel', email: `owner-${stamp}@example.com`, password: 'et-godt-kodeord-1' };
const viewer = { name: 'Farmor', email: `viewer-${stamp}@example.com`, password: 'et-godt-kodeord-2' };

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function signUp(page: Page, u: typeof owner, next?: string) {
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : '/signup');
  await page.getByLabel('Dit navn').fill(u.name);
  await page.getByLabel('E-mail').fill(u.email);
  await page.getByLabel('Adgangskode').fill(u.password);
  await page.getByRole('button', { name: 'Opret konto' }).click();
}

test.describe.configure({ mode: 'serial' });

let inviteLink = '';
let recipeUrl = '';

test('redirects signed-out users to login', async ({ page }) => {
  await page.goto('/recipes');
  await expect(page).toHaveURL(/\/login\?next=%2Frecipes/);
  await expect(page.getByRole('heading', { name: 'Velkommen tilbage' })).toBeVisible();
});

test('owner signs up, creates household and a structured recipe', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await signUp(page, owner);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel('Navn').fill('Familien Slot');
  await page.getByRole('button', { name: 'Opret husstand' }).click();
  await expect(page.getByRole('heading', { name: /Aksel/ })).toBeVisible();
  await expect(page.getByText('Kogebogen er tom').or(page.getByText('Velkommen til jeres kogebog'))).toBeVisible();

  await page.goto('/recipes/new');
  await page.getByLabel('Titel').fill('Oldemors æblekage');
  await page.getByLabel('Kort beskrivelse').fill('Den klassiske med makroner og flødeskum.');
  await page.getByLabel('Ny kategori').fill('Kager & Desserter');
  await page.getByRole('button', { name: 'Opret', exact: true }).click();
  await expect(page.getByLabel('Kategori', { exact: true })).not.toHaveValue('');
  await page.getByLabel('Portioner / antal').fill('4');
  await page.getByLabel('Forberedelse (min)').fill('30');
  await page.getByLabel('Tilberedning (min)').fill('20');
  await page.getByLabel('Tags').fill('jul, klassiker');

  // Paste a list: parser splits quantity / unit / name / preparation and sections.
  await page.getByRole('button', { name: 'Indsæt liste' }).click();
  await page.getByRole('dialog').getByLabel('Tekst').fill('Æblemos:\n750 g æbler, skrællede\n2½ dl sukker\nTopping:\n1 knsp vanilje\nen god klat smør');
  await page.getByRole('dialog').getByRole('button', { name: 'Tilføj' }).click();
  await expect(page.getByLabel('Ingrediens').first()).toHaveValue('æbler');

  await page.getByRole('button', { name: 'Indsæt tekst' }).click();
  await page.getByRole('dialog').getByLabel('Tekst').fill('1. Kog æblerne med sukker.\n2. Lag med makroner.\n3. Pynt med flødeskum.');
  await page.getByRole('dialog').getByRole('button', { name: 'Tilføj' }).click();

  await page.getByLabel('Nyt navn').fill('Oldemor Karen');
  await page.getByLabel('Relation').fill('Oldemor');
  await page.getByRole('button', { name: 'Tilføj', exact: true }).click();
  await expect(page.getByLabel('Kommer fra (person)')).not.toHaveValue('');
  await page.getByLabel('År', { exact: true }).fill('1952');

  await page.getByRole('button', { name: 'Opret opskrift' }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  recipeUrl = page.url();
  await expect(page.getByRole('heading', { level: 1, name: 'Oldemors æblekage' })).toBeVisible();
  await expect(page.getByText('Fra Oldemor Karen')).toBeVisible();
  await expect(page.getByText('ca. 1952')).toBeVisible();

  // Structured ingredients + sections + preserved unusual wording
  const ing = page.getByRole('region', { name: 'Ingredienser' });
  await expect(ing.getByText('Æblemos')).toBeVisible();
  await expect(ing.getByText('750 g')).toBeVisible();
  await expect(ing.getByText('2½ dl')).toBeVisible();
  await expect(ing.getByText('en god klat smør')).toBeVisible();

  // Deterministic serving scaling: 4 → 8 persons
  await ing.getByRole('button', { name: '8 pers.' }).click();
  await expect(ing.getByText('1½ kg')).toBeVisible();
  await expect(ing.getByText('5 dl')).toBeVisible();
  await expect(ing.getByRole('status').or(ing.locator('output'))).toContainText('8 personer');
  await ing.getByRole('button', { name: /Original/ }).click();
  await expect(ing.getByText('750 g')).toBeVisible();

  // Steps
  await expect(page.getByText('Kog æblerne med sukker.')).toBeVisible();
  await expect(page.getByText('Lag med makroner.')).toBeVisible();

  // Favorite
  await page.getByRole('button', { name: 'Gem som favorit' }).click();
  await expect(page.getByRole('button', { name: 'Favorit' })).toBeVisible();

  // Family story
  const stories = page.getByRole('region', { name: 'Historien bag' });
  await stories.getByRole('button', { name: 'Tilføj historie' }).click();
  await stories.getByRole('textbox', { name: 'Historien' }).fill('Oldemor bagte den hver jul på gården i Vejle.');
  await stories.getByLabel('Cirka år').fill('1960');
  await stories.getByRole('button', { name: 'Gem historie' }).click();
  await expect(page.getByText('Oldemor bagte den hver jul på gården i Vejle.')).toBeVisible();

  // Original scan upload (private storage + RLS)
  const heritage = page.getByRole('region', { name: 'Originaler og gamle billeder' });
  await heritage.locator('input[type=file]:not([capture])').setInputFiles({ name: 'opskriftskort.png', mimeType: 'image/png', buffer: PNG });
  await expect(heritage.getByRole('img')).toBeVisible();
  await expect(heritage.getByRole('listitem').getByText('Original opskrift (scan)')).toBeVisible();

  // Private note
  await page.getByLabel('Ny note').fill('Brug Belle de Boskoop.');
  await page.getByRole('button', { name: 'Gem note' }).click();
  await expect(page.getByText('Brug Belle de Boskoop.')).toBeVisible();

  expect(errors.filter((e) => /Content Security Policy|Refused/.test(e))).toEqual([]);
});

test('search, filters and favorites list', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(owner.email);
  await page.getByLabel('Adgangskode').fill(owner.password);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dine favoritter' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fra familien' })).toBeVisible();

  await page.goto('/recipes');
  await page.getByLabel('Søg i opskrifter').fill('makroner');
  await expect(page).toHaveURL(/q=makroner/);
  await expect(page.getByRole('link', { name: /Oldemors æblekage/ })).toBeVisible();
  await page.getByLabel('Søg i opskrifter').fill('lasagne');
  await expect(page.getByText('Ingen opskrifter matcher')).toBeVisible();

  await page.goto('/recipes?ingredients=æbler');
  await expect(page.getByRole('link', { name: /Oldemors æblekage/ })).toBeVisible();
  await page.goto('/recipes?ingredients=kylling');
  await expect(page.getByText('Ingen opskrifter matcher')).toBeVisible();
  await page.goto('/recipes?favorites=1&maxTime=60');
  await expect(page.getByRole('link', { name: /Oldemors æblekage/ })).toBeVisible();
});

test('edit keeps history; invite a viewer', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(owner.email);
  await page.getByLabel('Adgangskode').fill(owner.password);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL('/');

  await page.goto(`${recipeUrl}/edit`);
  await page.getByLabel('Titel').fill('Oldemors bedste æblekage');
  await page.getByRole('button', { name: 'Gem ændringer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oldemors bedste æblekage' })).toBeVisible();
  await page.getByRole('link', { name: 'Historik' }).first().click();
  await expect(page.getByText('Version 1: Oldemors æblekage')).toBeVisible();

  await page.goto('/settings');
  await page.getByLabel('Rolle', { exact: true }).selectOption('viewer');
  await page.getByRole('button', { name: 'Lav link' }).click();
  inviteLink = await page.getByLabel('Invitationslink').inputValue();
  expect(inviteLink).toMatch(/\/invite\/[A-Za-z0-9_-]{20,}$/);
});

test.describe('on a phone', () => {
  test.use(iphone);
  test('viewer joins by invite and can read but not edit', async ({ page }) => {
  const path = new URL(inviteLink).pathname;
  await page.goto(path);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole('link', { name: 'Opret konto' }).click();
  await page.getByLabel('Dit navn').fill(viewer.name);
  await page.getByLabel('E-mail').fill(viewer.email);
  await page.getByLabel('Adgangskode').fill(viewer.password);
  await page.getByRole('button', { name: 'Opret konto' }).click();
  await expect(page).toHaveURL(path);
  await page.getByRole('button', { name: 'Tilslut husstanden' }).click();
  await expect(page).toHaveURL('/');

  await page.goto(recipeUrl);
  await expect(page.getByRole('heading', { level: 1, name: 'Oldemors bedste æblekage' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Rediger' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tilføj historie' })).toHaveCount(0);
  // Owner's private note is not visible to others
  await expect(page.getByText('Brug Belle de Boskoop.')).toHaveCount(0);
  // Viewer can still favorite
  await page.getByRole('button', { name: 'Gem som favorit' }).click();
  await expect(page.getByRole('button', { name: 'Favorit' })).toBeVisible();

  // Direct navigation to edit is refused
  await page.goto(`${recipeUrl}/edit`);
  await expect(page).toHaveURL(recipeUrl);
  // Tab bar is used on phones
  await expect(page.getByRole('navigation', { name: 'Hovedmenu' }).last()).toBeVisible();
  });
});

test.describe('on an iPad', () => {
  test.use(ipad);
  test('recipe page shows ingredients beside steps', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(owner.email);
  await page.getByLabel('Adgangskode').fill(owner.password);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL('/');
  await page.goto(recipeUrl);
  const ing = page.getByRole('region', { name: 'Ingredienser' });
  const steps = page.getByRole('region', { name: 'Fremgangsmåde' });
  const a = await ing.boundingBox();
  const b = await steps.boundingBox();
  // Side by side in landscape: ingredients left of the steps.
  expect(a && b && a.x + a.width <= b.x + 1).toBeTruthy();
});
});

test('capture screenshots for design review', async ({ page }) => {
  test.skip(!process.env.E2E_SCREENSHOTS, 'set E2E_SCREENSHOTS=1 to capture');
  const dir = process.env.E2E_SCREENSHOTS!;
  await page.goto('/login');
  await page.screenshot({ path: `${dir}/login.png` });
  await page.getByLabel('E-mail').fill(owner.email);
  await page.getByLabel('Adgangskode').fill(owner.password);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL('/');
  await page.screenshot({ path: `${dir}/home.png`, fullPage: true });
  await page.goto('/recipes');
  await page.screenshot({ path: `${dir}/recipes.png` });
  await page.goto(recipeUrl);
  await page.screenshot({ path: `${dir}/recipe.png`, fullPage: true });
  await page.goto(`${recipeUrl}/edit`);
  await page.screenshot({ path: `${dir}/edit.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(recipeUrl);
  await page.screenshot({ path: `${dir}/recipe-phone.png`, fullPage: true });
});

/**
 * Builds a synthetic Mors Opskrifter database + App_files folder with the same
 * schema as the legacy EF Core migration, filled with the legacy DbSeeder
 * recipes plus edge cases seen in real family data. Used by tests and to
 * rehearse the import. Usage: pnpm --filter @vores-kok/migration fixture <outDir>
 */
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DDL = `
CREATE TABLE "AspNetRoles" ("Id" TEXT NOT NULL CONSTRAINT "PK_AspNetRoles" PRIMARY KEY, "Name" TEXT NULL, "NormalizedName" TEXT NULL, "ConcurrencyStamp" TEXT NULL);
CREATE TABLE "AspNetUsers" ("Id" TEXT NOT NULL CONSTRAINT "PK_AspNetUsers" PRIMARY KEY, "DisplayName" TEXT NOT NULL, "UserName" TEXT NULL, "NormalizedUserName" TEXT NULL, "Email" TEXT NULL, "NormalizedEmail" TEXT NULL, "EmailConfirmed" INTEGER NOT NULL, "PasswordHash" TEXT NULL, "SecurityStamp" TEXT NULL, "ConcurrencyStamp" TEXT NULL, "PhoneNumber" TEXT NULL, "PhoneNumberConfirmed" INTEGER NOT NULL, "TwoFactorEnabled" INTEGER NOT NULL, "LockoutEnd" TEXT NULL, "LockoutEnabled" INTEGER NOT NULL, "AccessFailedCount" INTEGER NOT NULL);
CREATE TABLE "AspNetUserRoles" ("UserId" TEXT NOT NULL, "RoleId" TEXT NOT NULL, CONSTRAINT "PK_AspNetUserRoles" PRIMARY KEY ("UserId", "RoleId"));
CREATE TABLE "Categories" ("Id" INTEGER NOT NULL CONSTRAINT "PK_Categories" PRIMARY KEY AUTOINCREMENT, "Name" TEXT NOT NULL, "Icon" TEXT NOT NULL);
CREATE TABLE "Recipes" ("Id" INTEGER NOT NULL CONSTRAINT "PK_Recipes" PRIMARY KEY AUTOINCREMENT, "Title" TEXT NOT NULL, "Category" TEXT NOT NULL, "CategoryIcon" TEXT NOT NULL, "PrepTimeMinutes" INTEGER NOT NULL, "CookTimeMinutes" INTEGER NOT NULL, "Servings" INTEGER NOT NULL, "Difficulty" TEXT NOT NULL, "Author" TEXT NOT NULL, "LastModified" TEXT NOT NULL, "Notes" TEXT NOT NULL, "OriginalImagePath" TEXT NULL);
CREATE TABLE "Ingredients" ("Id" INTEGER NOT NULL CONSTRAINT "PK_Ingredients" PRIMARY KEY AUTOINCREMENT, "RecipeId" INTEGER NOT NULL, "Amount" TEXT NOT NULL, "Unit" TEXT NOT NULL, "Name" TEXT NOT NULL, CONSTRAINT "FK_Ingredients_Recipes_RecipeId" FOREIGN KEY ("RecipeId") REFERENCES "Recipes" ("Id") ON DELETE CASCADE);
CREATE TABLE "RecipeSteps" ("Id" INTEGER NOT NULL CONSTRAINT "PK_RecipeSteps" PRIMARY KEY AUTOINCREMENT, "RecipeId" INTEGER NOT NULL, "SortOrder" INTEGER NOT NULL, "Text" TEXT NOT NULL, CONSTRAINT "FK_RecipeSteps_Recipes_RecipeId" FOREIGN KEY ("RecipeId") REFERENCES "Recipes" ("Id") ON DELETE CASCADE);
CREATE TABLE "UserFavorites" ("UserId" TEXT NOT NULL, "RecipeId" INTEGER NOT NULL, CONSTRAINT "PK_UserFavorites" PRIMARY KEY ("UserId", "RecipeId"));
CREATE TABLE "__EFMigrationsHistory" ("MigrationId" TEXT NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY, "ProductVersion" TEXT NOT NULL);
`;

type R = [title: string, cat: string, icon: string, prep: number, cook: number, serv: number, diff: string, author: string, modified: string, notes: string, image: string | null,
  ings: Array<[string, string, string]>, steps: string[]];

// The six DbSeeder recipes (verbatim) + edge cases.
const RECIPES: R[] = [
  ['Franskbrød', 'Brød & Bagværk', 'bread', 30, 120, 10, 'Middel', 'Mor', '2026-05-10 00:00:00', 'Bagte ved 200 grader og det blev perfekt.', 'a1b2c3d4-0000-4000-8000-000000000001.jpg',
    [['500', 'g', 'hvedemel'], ['25', 'g', 'gær'], ['3', 'dl', 'lunkent vand'], ['1', 'tsk', 'salt'], ['1', 'tsk', 'sukker']],
    ['Opløs gæren i lunkent vand med sukker.', 'Bland mel og salt, tilsæt gærblandingen.', 'Ælt dejen godt igennem i 10 minutter.', 'Lad hæve tildækket i 1 time.', 'Form til en aflang brødform og læg i smurt form.', 'Bag ved 200°C i 30-35 minutter til gyldenbrun.']],
  ['Kanelsnegle', 'Brød & Bagværk', 'croissant', 45, 60, 16, 'Middel', 'Mor', '2026-05-12 00:00:00', 'Dejen må ALDRIG blive for varm. Så bliver den doven som en mandag morgen. 😄', null,
    [['500', 'g', 'hvedemel'], ['50', 'g', 'gær'], ['2½', 'dl', 'mælk'], ['75', 'g', 'sukker'], ['1', 'tsk', 'kardemomme'], ['75', 'g', 'smør'], ['1', 'æg', '']],
    ['Opløs gæren i lun mælk.', 'Tilsæt sukker, kardemomme, æg og det bløde smør.', 'Tilsæt melet lidt ad gangen og ælt dejen godt igennem.', 'Lad dejen hæve tildækket i 45 minutter.', 'Rul dejen ud til en stor firkant.', 'Smør med blødt smør, drys med sukker og kanel.', 'Rul sammen og skær i skiver.', 'Efterhæv i 30 minutter.', 'Bag ved 200°C varmluft i 12-15 minutter.']],
  ['Drømmekage', 'Kager & Desserter', 'cake', 20, 40, 12, 'Let', 'Mor', '2026-04-22 00:00:00', 'Toppingen skal boble lidt på overfladen når den er klar.', null,
    [['3', 'stk', 'æg'], ['200', 'g', 'sukker'], ['200', 'g', 'hvedemel'], ['1', 'tsk', 'bagepulver'], ['1', 'dl', 'mælk'], ['100', 'g', 'kokos'], ['125', 'g', 'smør'], ['200', 'g', 'brun farin']],
    ['Pisk æg og sukker luftigt.', 'Tilsæt mel og bagepulver.', 'Tilsæt lun mælk og bland godt.', 'Bag ved 180°C i 25 min.', 'Smelt smør, tilsæt brun farin og kokos.', 'Bred toppingen over den halvbagte kage.', 'Bag videre i 10-15 min til toppingen er gyldenbrun.']],
  ['Vaniljekranse', 'Kager & Desserter', 'cookie', 30, 15, 40, 'Let', 'Mor', '2026-03-15 00:00:00', 'Sprøjteposen skal være kold for at dejen ikke flyder.', null,
    [['250', 'g', 'smør'], ['150', 'g', 'sukker'], ['1', 'stk', 'vaniljestang'], ['1', 'stk', 'æg'], ['375', 'g', 'hvedemel'], ['75', 'g', 'mandler, malede']],
    ['Bland blødt smør, sukker og vanilje.', 'Tilsæt æg og bland godt.', 'Tilsæt mel og malede mandler.', 'Pres dejen gennem en sprøjtpose med stjernedysse.', 'Form til kranse på bagepapir.', 'Bag ved 200°C i 8-10 minutter til lysegyldne.']],
  ['Lagkagebund', 'Kager & Desserter', 'cake', 15, 20, 8, 'Let', 'Mor', '2026-02-08 00:00:00', 'Afkøl altid bundene før de samles.', null,
    [['4', 'stk', 'æg'], ['150', 'g', 'sukker'], ['150', 'g', 'hvedemel'], ['1', 'tsk', 'bagepulver']],
    ['Pisk æg og sukker meget luftigt – mindst 10 min.', 'Sigt mel og bagepulver i og vend forsigtigt i æggemassen.', 'Hæld i en smurt springform.', 'Bag ved 175°C i 20-25 min.', 'Afkøl på bagerist.']],
  ['Rugbrød', 'Brød & Bagværk', 'bread', 20, 70, 12, 'Svær', 'Mor', '2026-01-30 00:00:00', 'Husk at starte surdej dagen i forvejen.', null,
    [['500', 'g', 'rugmel'], ['200', 'g', 'hvedemel'], ['3', 'dl', 'kærnemælk'], ['2', 'dl', 'vand'], ['1', 'spsk', 'salt'], ['2', 'spsk', 'maltsirup'], ['1', 'pose', 'tørgær'], ['100', 'g', 'solsikkekerner']],
    ['Bland mel, salt og gær i en stor skål.', 'Tilsæt kærnemælk, vand og maltsirup.', 'Tilsæt solsikkekerner og rør igen.', 'Hæld i smurt rugbrødsform og glat overfladen.', 'Lad hæve under et viskestykke i 1-2 timer.', 'Bag ved 175°C i ca. 70 minutter.', 'Afkøl på bagerist.']],
  // Edge cases
  ['Farmors sovs', 'Julebag', 'star', 0, 0, 0, 'Middel', 'Farmor', '2025-12-20 18:45:12.1234567', '', null,
    [['en smule', '', 'kulør'], ['efter smag', '', 'salt og peber'], ['1-2', 'spsk', 'hvedemel'], ['', '', 'Stegeskyen fra anden'], ['½', 'l', 'fløde']],
    ['Pisk mel ud i skyen.', '   ', 'Smag til — mere smør!']],
  ['   ', '', '', 10, 5, 2, '???', '', '2024-06-01 08:00:00', '', null, [['2', 'stk', 'æg']], ['Kog æggene.']],
];

export function buildFixture(dir: string): { dbPath: string; filesDir: string } {
  rmSync(dir, { recursive: true, force: true });
  const filesDir = join(dir, 'App_files');
  mkdirSync(filesDir, { recursive: true });
  const dbPath = join(dir, 'morsopskrifter.db');
  const db = new Database(dbPath);
  db.exec(DDL);
  db.prepare(`insert into "__EFMigrationsHistory" values ('20260531190801_InitialCreate', '10.0.8')`).run();
  const cat = db.prepare('insert into Categories (Name, Icon) values (?, ?)');
  for (const [n, i] of [['Brød & Bagværk', 'bread'], ['Kager & Desserter', 'cake'], ['Morgenmad', 'croissant'], ['Hverdagsretter', 'cookie']]) cat.run(n, i);
  const rec = db.prepare('insert into Recipes (Title, Category, CategoryIcon, PrepTimeMinutes, CookTimeMinutes, Servings, Difficulty, Author, LastModified, Notes, OriginalImagePath) values (?,?,?,?,?,?,?,?,?,?,?)');
  const ing = db.prepare('insert into Ingredients (RecipeId, Amount, Unit, Name) values (?,?,?,?)');
  const step = db.prepare('insert into RecipeSteps (RecipeId, SortOrder, Text) values (?,?,?)');
  for (const [title, c, icon, prep, cook, serv, diff, author, mod, notes, image, ings, steps] of RECIPES) {
    const id = Number(rec.run(title, c, icon, prep, cook, serv, diff, author, mod, notes, image).lastInsertRowid);
    for (const [a, u, n] of ings) ing.run(id, a, u, n);
    // Legacy create used index 0..n; seeder used 1..n. Insert out of order to test sorting.
    steps.map((t, i) => [i, t] as const).reverse().forEach(([i, t]) => step.run(id, i, t));
  }
  db.prepare(`insert into AspNetRoles values ('r1','Administrator','ADMINISTRATOR',null),('r2','User','USER',null)`).run();
  const user = db.prepare(`insert into AspNetUsers (Id, DisplayName, UserName, Email, EmailConfirmed, PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount, PasswordHash) values (?,?,?,?,0,0,0,1,0,'AQAAAAIAAYagAAAAE-not-a-real-hash')`);
  user.run('u-mor', 'Mor', 'mor', 'mor@example.com');
  user.run('u-far', 'Far', 'far', null);
  db.prepare(`insert into AspNetUserRoles values ('u-mor','r1'),('u-far','r2')`).run();
  db.prepare(`insert into UserFavorites values ('u-mor', 2), ('u-mor', 6), ('u-far', 3)`).run();
  db.close();
  // A tiny valid JPEG for the Franskbrød image.
  writeFileSync(join(filesDir, 'a1b2c3d4-0000-4000-8000-000000000001.jpg'), Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64'));
  return { dbPath, filesDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? 'fixtures/legacy';
  const r = buildFixture(out);
  console.log(`✓ fixture: ${r.dbPath} + ${r.filesDir}`);
}

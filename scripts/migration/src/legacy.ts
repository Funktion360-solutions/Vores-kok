/**
 * Reads a Mors Opskrifter SQLite database (App_dbs/morsopskrifter.db) exactly
 * as created by the EF Core migration 20260531190801_InitialCreate.
 * Opened read-only; the legacy file is never modified.
 */
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface LegacyCategory { Id: number; Name: string; Icon: string }
export interface LegacyRecipe {
  Id: number; Title: string; Category: string; CategoryIcon: string;
  PrepTimeMinutes: number; CookTimeMinutes: number; Servings: number; Difficulty: string;
  Author: string; LastModified: string; Notes: string; OriginalImagePath: string | null;
}
export interface LegacyIngredient { Id: number; RecipeId: number; Amount: string; Unit: string; Name: string }
export interface LegacyStep { Id: number; RecipeId: number; SortOrder: number; Text: string }
export interface LegacyUser { Id: string; UserName: string | null; DisplayName: string; Email: string | null; Role: string | null }
export interface LegacyFavorite { UserId: string; RecipeId: number }

export interface LegacyData {
  sha256: string;
  categories: LegacyCategory[];
  recipes: LegacyRecipe[];
  ingredients: LegacyIngredient[];
  steps: LegacyStep[];
  users: LegacyUser[];
  favorites: LegacyFavorite[];
  /** Columns found in the file that this importer does not know (reported, never dropped silently). */
  unknownColumns: Record<string, string[]>;
  unknownTables: string[];
}

const EXPECTED: Record<string, string[]> = {
  Categories: ['Id', 'Name', 'Icon'],
  Recipes: ['Id', 'Title', 'Category', 'CategoryIcon', 'PrepTimeMinutes', 'CookTimeMinutes', 'Servings', 'Difficulty', 'Author', 'LastModified', 'Notes', 'OriginalImagePath'],
  Ingredients: ['Id', 'RecipeId', 'Amount', 'Unit', 'Name'],
  RecipeSteps: ['Id', 'RecipeId', 'SortOrder', 'Text'],
  UserFavorites: ['UserId', 'RecipeId'],
  AspNetUsers: ['Id', 'DisplayName', 'UserName', 'NormalizedUserName', 'Email', 'NormalizedEmail', 'EmailConfirmed', 'PasswordHash', 'SecurityStamp', 'ConcurrencyStamp', 'PhoneNumber', 'PhoneNumberConfirmed', 'TwoFactorEnabled', 'LockoutEnd', 'LockoutEnabled', 'AccessFailedCount'],
};
// Identity tables with no data worth migrating (claims/logins/tokens are auth internals).
const KNOWN_IGNORED = new Set(['AspNetRoles', 'AspNetUserRoles', 'AspNetRoleClaims', 'AspNetUserClaims', 'AspNetUserLogins', 'AspNetUserTokens', '__EFMigrationsHistory', '__EFMigrationsLock', 'sqlite_sequence']);

export function readLegacy(path: string): LegacyData {
  const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const tables = (db.prepare(`select name from sqlite_master where type = 'table'`).all() as Array<{ name: string }>).map((t) => t.name);
    for (const t of Object.keys(EXPECTED)) {
      if (!tables.includes(t)) throw new Error(`Legacy table ${t} is missing — is this a Mors Opskrifter database?`);
    }
    const unknownColumns: Record<string, string[]> = {};
    for (const [t, cols] of Object.entries(EXPECTED)) {
      const actual = (db.prepare(`pragma table_info("${t}")`).all() as Array<{ name: string }>).map((c) => c.name);
      const missing = cols.filter((c) => !actual.includes(c));
      if (missing.length) throw new Error(`Legacy table ${t} lacks columns ${missing.join(', ')}`);
      const extra = actual.filter((c) => !cols.includes(c));
      if (extra.length) unknownColumns[t] = extra;
    }
    const unknownTables = tables.filter((t) => !EXPECTED[t] && !KNOWN_IGNORED.has(t));

    const all = <T>(sql: string) => db.prepare(sql).all() as T[];
    return {
      sha256,
      categories: all<LegacyCategory>('select Id, Name, Icon from Categories order by Id'),
      recipes: all<LegacyRecipe>('select * from Recipes order by Id'),
      ingredients: all<LegacyIngredient>('select Id, RecipeId, Amount, Unit, Name from Ingredients order by RecipeId, Id'),
      steps: all<LegacyStep>('select Id, RecipeId, SortOrder, Text from RecipeSteps order by RecipeId, SortOrder, Id'),
      users: all<LegacyUser>(`
        select u.Id, u.UserName, u.DisplayName, u.Email,
               (select r.Name from AspNetUserRoles ur join AspNetRoles r on r.Id = ur.RoleId where ur.UserId = u.Id
                order by case r.Name when 'Administrator' then 0 else 1 end limit 1) as Role
        from AspNetUsers u order by u.UserName`),
      favorites: all<LegacyFavorite>('select UserId, RecipeId from UserFavorites order by UserId, RecipeId'),
      unknownColumns,
      unknownTables,
    };
  } finally {
    db.close();
  }
}

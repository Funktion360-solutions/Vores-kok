/**
 * Household permission matrix. The database (RLS + RPC checks) is the
 * authority; this mirror exists only so UIs can hide actions a user cannot
 * perform. Keep in sync with docs/security/household-permissions.md.
 */
export const HOUSEHOLD_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export const ROLE_LABELS: Record<HouseholdRole, string> = {
  owner: 'Ejer',
  admin: 'Administrator',
  member: 'Medlem',
  viewer: 'Læser',
};

export const ROLE_DESCRIPTIONS: Record<HouseholdRole, string> = {
  owner: 'Fuld kontrol, inkl. sletning af husstanden og administratorer.',
  admin: 'Kan invitere, administrere medlemmer, kategorier og slette opskrifter.',
  member: 'Kan oprette og redigere opskrifter, billeder og historier.',
  viewer: 'Kan læse alt, gemme favoritter og private noter.',
};

const RANK: Record<HouseholdRole, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export function roleRank(role: HouseholdRole | null | undefined): number {
  return role ? RANK[role] : 0;
}

export function hasRole(role: HouseholdRole | null | undefined, min: HouseholdRole): boolean {
  return roleRank(role) >= RANK[min];
}

export type HouseholdAction =
  | 'recipe.read'
  | 'recipe.create'
  | 'recipe.edit'
  | 'recipe.archive'
  | 'recipe.delete'
  | 'media.upload'
  | 'media.delete'
  | 'story.edit'
  | 'people.edit'
  | 'people.delete'
  | 'category.edit'
  | 'category.delete'
  | 'favorite'
  | 'note.private'
  | 'note.share'
  | 'household.rename'
  | 'household.delete'
  | 'member.invite'
  | 'member.inviteAdmin'
  | 'member.manage';

const MIN_ROLE: Record<HouseholdAction, HouseholdRole> = {
  'recipe.read': 'viewer',
  'recipe.create': 'member',
  'recipe.edit': 'member',
  'recipe.archive': 'member',
  'recipe.delete': 'admin',
  'media.upload': 'member',
  'media.delete': 'member',
  'story.edit': 'member',
  'people.edit': 'member',
  'people.delete': 'admin',
  'category.edit': 'member',
  'category.delete': 'admin',
  favorite: 'viewer',
  'note.private': 'viewer',
  'note.share': 'member',
  'household.rename': 'admin',
  'household.delete': 'owner',
  'member.invite': 'admin',
  'member.inviteAdmin': 'owner',
  'member.manage': 'admin',
};

export function can(role: HouseholdRole | null | undefined, action: HouseholdAction): boolean {
  return hasRole(role, MIN_ROLE[action]);
}

/** Roles an actor may assign to others (mirrors set_household_member_role). */
export function assignableRoles(actor: HouseholdRole | null | undefined): HouseholdRole[] {
  if (actor === 'owner') return ['owner', 'admin', 'member', 'viewer'];
  if (actor === 'admin') return ['member', 'viewer'];
  return [];
}

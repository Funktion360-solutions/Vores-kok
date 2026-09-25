import 'server-only';
import { getMyProfile, listMyHouseholds, type Household, type VKClient } from '@vores-kok/database';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from './supabase/server';

export const HOUSEHOLD_COOKIE = 'vk_household';

export interface SessionContext {
  db: VKClient;
  user: User;
  displayName: string;
  households: Household[];
  household: Household | null;
}

/** Per-request session: verified user (getUser hits Auth), profile and households. */
export const getSession = cache(async (): Promise<SessionContext> => {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login');
  const [profile, households] = await Promise.all([getMyProfile(db, data.user.id), listMyHouseholds(db)]);
  const wanted = (await cookies()).get(HOUSEHOLD_COOKIE)?.value;
  // The cookie is only a preference; membership comes from the database.
  const household = households.find((h) => h.id === wanted) ?? households[0] ?? null;
  return { db, user: data.user, displayName: profile?.display_name ?? data.user.email ?? 'Dig', households, household };
});

export async function requireHousehold(): Promise<SessionContext & { household: Household }> {
  const s = await getSession();
  if (!s.household) redirect('/onboarding');
  return s as SessionContext & { household: Household };
}

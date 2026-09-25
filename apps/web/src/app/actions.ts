'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { listMyHouseholds } from '@vores-kok/database';
import { HOUSEHOLD_COOKIE } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

/** Remembers the active household (a preference only — access is enforced by RLS). */
export async function switchHousehold(householdId: string) {
  const db = await createClient();
  const households = await listMyHouseholds(db);
  if (!households.some((h) => h.id === householdId)) throw new Error('Ukendt husstand');
  (await cookies()).set(HOUSEHOLD_COOKIE, householdId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  (await cookies()).delete(HOUSEHOLD_COOKIE);
  redirect('/login');
}

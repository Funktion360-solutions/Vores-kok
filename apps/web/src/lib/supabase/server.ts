import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { Database, VKClient } from '@vores-kok/database';
import { cookies } from 'next/headers';
import { env } from '../env';

/** Supabase client for Server Components / Route Handlers, acting as the signed-in user. */
export async function createClient(): Promise<VKClient> {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database, VKClient } from '@vores-kok/database';
import { env } from '../env';

let client: VKClient | undefined;

/** Browser Supabase client (anon key + user session cookie). Never holds privileged keys. */
export function getBrowserClient(): VKClient {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}

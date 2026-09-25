/** Public runtime configuration. Only NEXT_PUBLIC_* values belong here. */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See apps/web/.env.example.`);
  return value;
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};

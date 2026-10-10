import { requireHousehold } from '@/lib/session';
import type { SupabaseClient } from '@supabase/supabase-js';
import { savedDocumentSchema } from '../../../../../../../packages/validation/src/commerce';
import { PurchaseHistory } from '@/components/shopping/purchase-history';
import { Alert } from '@/components/ui';
export const metadata = { title: 'Købshistorik' };
export default async function Page() {
  const { db, household } = await requireHousehold();
  const { data, error } = await (db as unknown as SupabaseClient)
    .from('vk_commerce_documents')
    .select('id,kind,payload,created_at')
    .eq('household_id', household.id)
    .eq('kind', 'receipt')
    .order('created_at', { ascending: false })
    .limit(201);
  if (error)
    return <Alert>Købshistorikken kunne ikke hentes. Kontrollér databaseopsætningen.</Alert>;
  const parsed = savedDocumentSchema.array().safeParse(data);
  if (!parsed.success) return <Alert>En kvittering indeholder ugyldige data.</Alert>;
  return (
    <PurchaseHistory documents={parsed.data.slice(0, 200)} truncated={parsed.data.length > 200} />
  );
}

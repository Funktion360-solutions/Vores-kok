import { listShoppingLists } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireHousehold } from '@/lib/session';
import { savedDocumentSchema } from '../../../../../../../packages/validation/src/commerce';
import { OffersView } from '@/components/shopping/offers-view';
export const metadata = { title: 'Tilbud og tilbudsaviser' };
export default async function Page() {
  const { db, household } = await requireHousehold();
  const { data, error } = await (db as unknown as SupabaseClient)
    .from('vk_commerce_documents')
    .select('id,kind,payload,created_at')
    .eq('household_id', household.id)
    .eq('kind', 'flyer')
    .order('created_at', { ascending: false })
    .limit(101);
  const parsed = savedDocumentSchema.array().safeParse(data);
  return (
    <OffersView
      householdId={household.id}
      documents={parsed.success ? parsed.data.slice(0, 100) : []}
      initialWarning={
        error || !parsed.success
          ? 'Importerede tilbud kunne ikke hentes.'
          : parsed.data.length > 100
            ? 'Viser de seneste 100 importerede tilbudsaviser.'
            : ''
      }
      lists={await listShoppingLists(db, household.id)}
      canEdit={can(household.role, 'recipe.edit')}
    />
  );
}

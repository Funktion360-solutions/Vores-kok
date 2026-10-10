import { listPantryLocations } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import { requireHousehold } from '@/lib/session';
import { CommerceImport } from '@/components/shopping/commerce-import';
import { Alert } from '@/components/ui';
export const metadata = { title: 'Importér kvittering eller tilbudsavis' };
export default async function Page() {
  const { db, household, user } = await requireHousehold();
  if (!can(household.role, 'recipe.edit'))
    return <Alert>Du skal være medlem for at importere.</Alert>;
  return (
    <CommerceImport
      householdId={household.id}
      userId={user.id}
      locations={await listPantryLocations(db, household.id)}
    />
  );
}

import { listCategories, listInvites, listMembers } from '@vores-kok/database';
import { can } from '@vores-kok/domain';
import type { Metadata } from 'next';
import { CategoryManager } from '@/components/settings/category-manager';
import { HouseholdSettings } from '@/components/settings/household-settings';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { PageHeader } from '@/components/ui';
import { env } from '@/lib/env';
import { requireHousehold } from '@/lib/session';

export const metadata: Metadata = { title: 'Indstillinger' };

export default async function SettingsPage() {
  const { db, household, user, displayName } = await requireHousehold();
  const [members, invites, categories] = await Promise.all([
    listMembers(db, household.id),
    can(household.role, 'member.invite') ? listInvites(db, household.id) : Promise.resolve([]),
    listCategories(db, household.id),
  ]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader title="Indstillinger" />
      <ProfileSettings userId={user.id} displayName={displayName} email={user.email ?? ''} />
      <HouseholdSettings household={household} members={members} invites={invites} siteUrl={env.siteUrl} />
      <CategoryManager categories={categories} householdId={household.id} canEdit={can(household.role, 'category.edit')} canDelete={can(household.role, 'category.delete')} />
    </div>
  );
}

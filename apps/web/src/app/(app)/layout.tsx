import { can } from '@vores-kok/domain';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/brand';
import { HouseholdSwitcher } from '@/components/household-switcher';
import { SideNav, TabBar } from '@/components/nav';
import { getSession } from '@/lib/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { households, household, displayName } = await getSession();
  const canCreate = household ? can(household.role, 'recipe.create') : false;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2">Spring til indhold</a>
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper/70 px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 px-2"><Wordmark /></Link>
        {household ? <SideNav canCreate={canCreate} /> : null}
        <div className="mt-auto px-2 text-sm text-ink-muted">
          <div className="truncate font-medium text-ink-soft">{displayName}</div>
          {household ? <HouseholdSwitcher households={households} currentId={household.id} /> : null}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-cream/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/"><Wordmark /></Link>
          {household ? <HouseholdSwitcher households={households} currentId={household.id} /> : null}
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>
      </div>
      {household ? <TabBar /> : null}
    </div>
  );
}

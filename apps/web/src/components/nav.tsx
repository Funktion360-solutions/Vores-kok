'use client';
import clsx from 'clsx';
import { BookOpen, CalendarDays, Home, MoreHorizontal, Plus, Refrigerator, ShoppingBasket, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Primary navigation (spec): Hjem · Opskrifter · Madplan · Indkøb · Mere.
const ITEMS = [
  { href: '/', label: 'Hjem', icon: Home, match: (p: string) => p === '/' },
  { href: '/recipes', label: 'Opskrifter', icon: BookOpen, match: (p: string) => p.startsWith('/recipes') },
  { href: '/plan', label: 'Madplan', icon: CalendarDays, match: (p: string) => p.startsWith('/plan') },
  { href: '/shopping', label: 'Indkøb', icon: ShoppingBasket, match: (p: string) => p.startsWith('/shopping') },
  { href: '/more', label: 'Mere', icon: MoreHorizontal, match: (p: string) => ['/more', '/settings', '/kitchen', '/family'].some((x) => p.startsWith(x)) },
];
// Extra destinations shown directly in the desktop/iPad sidebar.
const SIDE_EXTRA = [
  { href: '/kitchen', label: 'Mit køkken', icon: Refrigerator, match: (p: string) => p.startsWith('/kitchen') },
  { href: '/family', label: 'Familie', icon: Users, match: (p: string) => p.startsWith('/family') },
];

export function SideNav({ canCreate }: { canCreate: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Hovedmenu" className="flex flex-col gap-1">
      {canCreate ? (
        <Link href="/recipes/new" className="mb-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 font-medium text-white hover:bg-brand-dark">
          <Plus className="size-5" aria-hidden /> Ny opskrift
        </Link>
      ) : null}
      {[...ITEMS.slice(0, 4), ...SIDE_EXTRA, { ...ITEMS[4]!, match: (p: string) => p.startsWith('/more') || p.startsWith('/settings') }].map(({ href, label, icon: Icon, match }) => {
        const active = match(path);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={clsx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
              active ? 'bg-brand-soft text-brand-dark' : 'text-ink-soft hover:bg-sand hover:text-ink')}>
            <Icon className="size-5" aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Hovedmenu" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? 'page' : undefined}
                className={clsx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium', active ? 'text-brand' : 'text-ink-muted')}>
                <Icon className="size-6" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

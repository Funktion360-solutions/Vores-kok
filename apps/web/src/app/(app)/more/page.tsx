import { CalendarDays, ChefHat, Download, LogOut, MessageCircle, Refrigerator, Settings, ShoppingBasket, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/app/actions';
import { Badge, Card, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Mere' };

function Item({ href, icon, title, text, soon }: { href?: string; icon: ReactNode; title: string; text: string; soon?: string }) {
  const body = (
    <Card className={`flex h-full items-start gap-4 p-5 ${href ? 'transition-colors hover:bg-sand' : 'opacity-80'}`}>
      <span className="rounded-xl bg-brand-soft p-2.5 text-brand-dark">{icon}</span>
      <span>
        <span className="flex items-center gap-2 font-display text-lg font-semibold">{title}{soon ? <Badge tone="honey">{soon}</Badge> : null}</span>
        <span className="mt-0.5 block text-sm text-ink-soft">{text}</span>
      </span>
    </Card>
  );
  return <li>{href ? <Link href={href}>{body}</Link> : body}</li>;
}

export default function MorePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Mere" />
      <ul className="grid gap-4 sm:grid-cols-2">
        <Item href="/family" icon={<Users className="size-6" />} title="Familie" text="Personerne og historierne bag opskrifterne." />
        <Item href="/settings" icon={<Settings className="size-6" />} title="Indstillinger" text="Profil, husstand, medlemmer, invitationer og kategorier." />
      </ul>
      <h2 className="mb-3 mt-10 text-xl font-semibold">På vej</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        <Item icon={<CalendarDays className="size-6" />} title="Madplan" text="Planlæg ugens måltider sammen." soon="Fase 2" />
        <Item icon={<ShoppingBasket className="size-6" />} title="Indkøb" text="Fælles indkøbslister, der opdateres live." soon="Fase 2" />
        <Item icon={<Refrigerator className="size-6" />} title="Mit køkken" text="Hvad har vi i køleskab, fryser og skabe?" soon="Fase 2" />
        <Item icon={<ChefHat className="size-6" />} title="Kogetilstand" text="Trin for trin med store knapper og timere." soon="Fase 2" />
        <Item icon={<Download className="size-6" />} title="Importér" text="Fra hjemmesider, fotos, PDF og håndskrevne kort." soon="Fase 3" />
        <Item icon={<MessageCircle className="size-6" />} title="Assistent" text="“Hvad kan vi lave?” og erstatninger." soon="Fase 3" />
      </ul>
      <form action={signOut} className="mt-10">
        <button type="submit" className="flex min-h-11 items-center gap-2 rounded-full px-4 text-ink-soft hover:bg-sand hover:text-ink"><LogOut className="size-5" aria-hidden /> Log ud</button>
      </form>
    </div>
  );
}

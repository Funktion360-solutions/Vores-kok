import { Cake, Cookie, Croissant, Folder, IceCreamCone, Sandwich, Star, UtensilsCrossed, Wheat } from 'lucide-react';

const ICONS = { bread: Wheat, cake: Cake, cookie: Cookie, croissant: Croissant, dessert: IceCreamCone, folder: Folder, star: Star, sandwich: Sandwich } as const;

export function CategoryIcon({ icon, className = 'size-5' }: { icon: string | null | undefined; className?: string }) {
  const Icon = (icon && ICONS[icon as keyof typeof ICONS]) || UtensilsCrossed;
  return <Icon className={className} aria-hidden />;
}

export const ICON_CHOICES = Object.keys(ICONS);

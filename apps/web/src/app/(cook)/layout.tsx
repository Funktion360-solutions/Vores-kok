import type { ReactNode } from 'react';

/** Distraction-free layout for cook mode (no sidebar/tab bar). */
export default function CookLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-cream">{children}</div>;
}
